// src/order/order.resolver.ts
import { Resolver, Subscription, Args, Mutation, Context, Query } from '@nestjs/graphql';
import { pubSub } from 'src/pubsub';
import { Order } from 'src/entities/order.entity';
import { User } from 'src/entities/user.entity';
import { haversineDistance } from 'src/common/utils/helper';
import { Logger } from '@nestjs/common';
import { log } from 'console';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from 'src/entities/review.entity';

interface EligibleShipper {
    shipperId: string;
    latitude: number;
    longitude: number;
    maxDistance: number;
    lastSeen: Date;
    eligibilityScore: number;
    user: User;
    distanceFromRestaurant?: number;
}

interface ShipperQueue {
    shipperId: string;
    priority: number;
    addedAt: Date;
    eligibilityScore: number;
    distanceKm: number;
}

// Lớp dịch vụ nâng cao quản lý trạng thái các shipper đang trực tuyến (hoạt động), 
// và kiểm tra các điều kiện (constraints) hệ thống cho shipper.
class ActiveShipperTracker {
    // Map lưu trữ thông tin các shipper đang active
    private activeShippers: Map<string, EligibleShipper> = new Map();
    private shipperQueue: Map<string, ShipperQueue[]> = new Map(); // orderId -> sorted shipper list
    private readonly logger = new Logger(ActiveShipperTracker.name);
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(
        private systemConstraintsService: SystemConstraintsService,
        private userRepository: Repository<User>,
        private reviewRepository: Repository<Review>,
    ) {
        // Setup periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Khởi tạo Tracker với các dependencies cần thiết.
     * Cần gọi hàm này để nạp các service/repository sau khi khởi tạo biến ActiveShipperTracker.
     */
    initialize(
        systemConstraintsService: SystemConstraintsService,
        userRepository: Repository<User>,
        reviewRepository: Repository<Review>
    ) {
        (this as any).systemConstraintsService = systemConstraintsService;
        (this as any).userRepository = userRepository;
        (this as any).reviewRepository = reviewRepository;
    }

    /**
     * Thêm shipper vào danh sách hoạt động (active pool).
     * Kiểm tra chặt chẽ tính hợp lệ (eligibility) của shipper dựa trên hệ thống trước khi thêm.
     */
    async addShipper(
        shipperId: string, 
        lat: number, 
        lng: number, 
        maxDistance: number
    ): Promise<{ success: boolean; message: string; score?: number }> {
        try {
            this.logger.log(`🔍 Adding shipper ${shipperId} to active pool...`);

            // Validate input parameters
            if (!shipperId || typeof shipperId !== 'string') {
                return { success: false, message: 'Invalid shipper ID provided' };
            }

            if (isNaN(lat) || isNaN(lng) || isNaN(maxDistance)) {
                return { success: false, message: 'Invalid location or distance parameters' };
            }

            // Check if repositories are properly initialized
            if (!this.userRepository) {
                this.logger.error('❌ UserRepository not initialized');
                return { success: false, message: 'Internal error: repository not available' };
            }

            if (!this.systemConstraintsService) {
                this.logger.error('❌ SystemConstraintsService not initialized');
                return { success: false, message: 'Internal error: constraints service not available' };
            }

            // Fetch full user data with performance metrics - FIX THE QUERY
            this.logger.log(`🔍 Fetching user data for shipper ${shipperId}...`);
            
            const shipper = await this.userRepository.findOne({
                where: { id: shipperId }, // ✅ Fixed: Properly specify the where condition
                relations: ['role', 'shipperCertificateInfo', 'address']
            });

            if (!shipper) {
                this.logger.warn(`❌ Shipper ${shipperId} not found in database`);
                return { success: false, message: 'Shipper not found' };
            }

            this.logger.log(`✅ Found shipper: ${shipper.username || 'N/A'} with role: ${shipper.role?.name || 'N/A'}`);

            // Check shipper eligibility using system constraints
            this.logger.log(`🔍 Checking eligibility for shipper ${shipperId}...`);
            
            const eligibilityCheck = await this.systemConstraintsService.isShipperEligible(shipper);
            
            if (!eligibilityCheck.eligible) {
                this.logger.warn(`❌ Shipper ${shipperId} not eligible: ${eligibilityCheck.reasons.join(', ')}`);
                return { 
                    success: false, 
                    message: `Not eligible: ${eligibilityCheck.reasons.join(', ')}`,
                    score: eligibilityCheck.score
                };
            }

            this.logger.log(`✅ Shipper ${shipperId} is eligible with base score: ${eligibilityCheck.score}`);

            // Calculate enhanced shipper score including reviews
            const enhancedScore = await this.calculateEnhancedScore(shipper, eligibilityCheck.score);

            // Add to active shippers pool
            this.activeShippers.set(shipperId, {
                shipperId,
                latitude: lat,
                longitude: lng,
                maxDistance,
                lastSeen: new Date(),
                eligibilityScore: enhancedScore,
                user: shipper
            });

            // Update shipper's last active time
            try {
                shipper.lastActiveAt = new Date();
                await this.userRepository.save(shipper);
                this.logger.log(`✅ Updated last active time for shipper ${shipperId}`);
            } catch (saveError) {
                this.logger.warn(`⚠️ Failed to update last active time for shipper ${shipperId}: ${saveError.message}`);
                // Don't fail the whole operation for this
            }

            this.logger.log(`✅ Shipper ${shipperId} added to active pool with enhanced score ${enhancedScore}`);
            
            // Process any pending assignments for this shipper
            await this.processPendingAssignmentsForShipper(shipperId);

            return { 
                success: true, 
                message: 'Successfully added to shipper pool',
                score: enhancedScore
            };

        } catch (error) {
            this.logger.error(`❌ Error adding shipper ${shipperId}: ${error.message}`, error.stack);
            return { success: false, message: 'Internal error occurred' };
        }
    }

    /**
     * Tính toán điểm số ưu tiên (enhanced score) cho shipper 
     * bằng cách kết hợp điểm cơ bản với dữ liệu đánh giá (review), hoạt động gần đây để ưu tiên gán đơn.
     */
    private async calculateEnhancedScore(shipper: User, baseScore: number): Promise<number> {
        try {
            // Safely check if reviewRepository is available
            if (!this.reviewRepository) {
                this.logger.warn('⚠️ ReviewRepository not available, using base score');
                return baseScore;
            }

            // Get recent reviews for this shipper
            const recentReviews = await this.reviewRepository.find({
                where: { 
                    shipper: { id: shipper.id },
                    type: 'shipper'
                },
                order: { createdAt: 'DESC' },
                take: 20 // Last 20 reviews
            });

            let enhancedScore = baseScore;

            // Recent performance bonus (last 10 reviews average)
            if (recentReviews.length >= 5) {
                const recentAverage = recentReviews.slice(0, 10).reduce((sum, review) => sum + review.rating, 0) / Math.min(10, recentReviews.length);
                if (recentAverage > 4.5) {
                    enhancedScore += 10; // Recent excellent performance bonus
                } else if (recentAverage > 4.0) {
                    enhancedScore += 5; // Good recent performance
                } else if (recentAverage < 3.0) {
                    enhancedScore -= 15; // Poor recent performance penalty
                }
            }

            // Consistency bonus - low standard deviation in ratings
            if (recentReviews.length >= 10) {
                const ratings = recentReviews.map(r => r.rating);
                const mean = ratings.reduce((a, b) => a + b) / ratings.length;
                const variance = ratings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ratings.length;
                const stdDev = Math.sqrt(variance);
                
                if (stdDev < 0.5) {
                    enhancedScore += 5; // Very consistent performance
                } else if (stdDev > 1.5) {
                    enhancedScore -= 5; // Inconsistent performance
                }
            }

            // Active time bonus
            const now = new Date();
            const lastActive = shipper.lastActiveAt || new Date(0);
            const minutesInactive = (now.getTime() - lastActive.getTime()) / (1000 * 60);
            
            if (minutesInactive < 5) {
                enhancedScore += 5; // Very recent activity
            } else if (minutesInactive < 15) {
                enhancedScore += 2; // Recent activity
            }

            // Workload balance - penalize overloaded shippers
            const activeDeliveries = shipper.activeDeliveries || 0;
            if (activeDeliveries >= 3) {
                enhancedScore -= activeDeliveries * 5;
            }

            return Math.max(0, Math.round(enhancedScore * 100) / 100);

        } catch (error) {
            this.logger.error(`Error calculating enhanced score for shipper ${shipper.id}: ${error.message}`);
            return baseScore;
        }
    }

    /**
     * Quét và xử lý việc gán các đơn hàng đang chờ (pending orders) 
     * ngay khi một shipper vừa chuyển sang trạng thái trực tuyến (online) hoặc cập nhật vị trí.
     */
    private async processPendingAssignmentsForShipper(shipperId: string): Promise<void> {
        try {
            const shipper = this.activeShippers.get(shipperId);
            if (!shipper) return;

            let assignedCount = 0;

            // Check all pending orders in queue
            for (const [orderId, queuedShippers] of this.shipperQueue.entries()) {
                const shipperInQueue = queuedShippers.find(s => s.shipperId === shipperId);
                if (shipperInQueue) {
                    this.logger.log(`🔄 Processing pending assignment for order ${orderId} with shipper ${shipperId}`);
                    
                    try {
                        // Get order details (you'll need to implement this method)
                        const orderDetails = await this.getOrderById(orderId);
                        
                        if (orderDetails && orderDetails.status === 'confirmed' && !orderDetails.shippingDetail) {
                            await pubSub.publish('orderConfirmedForShippers', {
                                orderConfirmedForShippers: orderDetails,
                                targetShipperId: shipperId,
                                distanceKm: shipperInQueue.distanceKm,
                                priorityScore: shipperInQueue.priority
                            });
                            
                            assignedCount++;
                            
                            // Limit assignments per shipper per session
                            if (assignedCount >= 3) break;
                        }
                    } catch (error) {
                        this.logger.error(`❌ Failed to send order ${orderId} to shipper ${shipperId}: ${error.message}`);
                    }
                }
            }

            if (assignedCount > 0) {
                this.logger.log(`📦 Sent ${assignedCount} pending orders to shipper ${shipperId}`);
            }
        } catch (error) {
            this.logger.error(`❌ Error processing pending assignments for shipper ${shipperId}: ${error.message}`);
        }
    }

    /**
     * Find best shipper for an order with comprehensive scoring
     */
    async findBestShipperForOrder(
        restaurantLat: number, 
        restaurantLng: number,
        orderValue: number = 0,
        urgency: 'low' | 'medium' | 'high' = 'medium'
    ): Promise<{ shipperId: string; score: number; distance: number } | null> {
        try {
            if (!this.systemConstraintsService) {
                this.logger.error('❌ SystemConstraintsService not available');
                return null;
            }

            const constraints = await this.systemConstraintsService.getConstraints();
            const eligibleShippers: Array<EligibleShipper & { finalScore: number; distance: number }> = [];

            for (const [shipperId, shipper] of this.activeShippers.entries()) {
                // Calculate distance
                const distance = haversineDistance(
                    shipper.latitude,
                    shipper.longitude,
                    restaurantLat,
                    restaurantLng
                );

                // Kiểm tra xem khoảng cách có nằm trong giới hạn cho phép của shipper và mức tối đa của hệ thống không
                if (distance <= shipper.maxDistance && distance <= constraints.max_delivery_distance) {
                    // Xác thực lại tính hợp lệ của shipper (đề phòng trạng thái vừa thay đổi)
                    const eligibilityCheck = await this.systemConstraintsService.isShipperEligible(shipper.user);
                    
                    if (eligibilityCheck.eligible) {
                        // Tính toán điểm số cuối cùng để xếp hạng ưu tiên gán đơn
                        let finalScore = shipper.eligibilityScore;

                        // Trừ điểm dựa trên khoảng cách (khoảng cách càng xa bị trừ càng nhiều điểm, tối đa 25 điểm)
                        // Giúp ưu tiên shipper ở gần nhà hàng hơn
                        const maxDistance = constraints.max_delivery_distance;
                        const distancePenalty = (distance / maxDistance) * 25;
                        finalScore -= distancePenalty;

                        // Urgency bonus
                        const urgencyBonus = {
                            'high': 15,
                            'medium': 8,
                            'low': 0
                        }[urgency];
                        finalScore += urgencyBonus;

                        // Order value bonus (higher value orders get priority)
                        const valueBonus = Math.min(10, (orderValue / 100000) * 5);
                        finalScore += valueBonus;

                        // Active deliveries penalty (progressive)
                        const activeDeliveriesPenalty = Math.pow(shipper.user.activeDeliveries || 0, 1.5) * 3;
                        finalScore -= activeDeliveriesPenalty;

                        // Recent activity bonus (active within last 5 minutes gets bonus)
                        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                        const recentActivityBonus = shipper.lastSeen > fiveMinutesAgo ? 8 : 0;
                        finalScore += recentActivityBonus;

                        // Time of day bonus (lunch/dinner rush hours)
                        const hour = new Date().getHours();
                        const rushHourBonus = (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 20) ? 5 : 0;
                        finalScore += rushHourBonus;

                        finalScore = Math.max(0, finalScore);

                        eligibleShippers.push({
                            ...shipper,
                            distance,
                            finalScore
                        });
                    }
                }
            }

            if (eligibleShippers.length === 0) {
                this.logger.warn(`❌ No eligible shippers found for restaurant at ${restaurantLat}, ${restaurantLng}`);
                return null;
            }

            // Sort by final score (highest first)
            eligibleShippers.sort((a, b) => b.finalScore - a.finalScore);

            const bestShipper = eligibleShippers[0];
            this.logger.log(`🎯 Best shipper found: ${bestShipper.shipperId} with score ${bestShipper.finalScore.toFixed(2)} at distance ${bestShipper.distance.toFixed(2)}km`);

            return {
                shipperId: bestShipper.shipperId,
                score: bestShipper.finalScore,
                distance: bestShipper.distance
            };
        } catch (error) {
            this.logger.error(`❌ Error finding best shipper: ${error.message}`);
            return null;
        }
    }

    /**
     * Tạo hàng đợi (Priority Queue) ưu tiên các shipper phù hợp cho một đơn hàng cụ thể.
     * Càng tính được shipper gần và điểm tín nhiệm tốt, độ ưu tiên lấy đơn càng cao.
     */
    async createShipperQueueForOrder(
        orderId: string,
        restaurantLat: number,
        restaurantLng: number,
        orderValue: number = 0,
        urgency: 'low' | 'medium' | 'high' = 'medium'
    ): Promise<ShipperQueue[]> {
        const constraints = await this.systemConstraintsService.getConstraints();
        const queuedShippers: ShipperQueue[] = [];

        for (const [shipperId, shipper] of this.activeShippers.entries()) {
            const distance = haversineDistance(
                shipper.latitude,
                shipper.longitude,
                restaurantLat,
                restaurantLng
            );

            // Check if shipper can handle this order
            if (distance <= shipper.maxDistance && distance <= constraints.max_delivery_distance) {
                const eligibilityCheck = await this.systemConstraintsService.isShipperEligible(shipper.user);
                
                if (eligibilityCheck.eligible) {
                    // Calculate priority using same logic as findBestShipper
                    let priority = shipper.eligibilityScore;
                    
                    // Distance factor (closer gets higher priority)
                    priority += Math.max(0, 50 - distance * 3);
                    
                    // Active deliveries factor
                    priority -= Math.pow(shipper.user.activeDeliveries, 1.5) * 3;

                    // Order value factor
                    priority += Math.min(10, (orderValue / 100000) * 5);

                    // Urgency factor
                    priority += { 'high': 15, 'medium': 8, 'low': 0 }[urgency];

                    queuedShippers.push({
                        shipperId,
                        priority: Math.max(0, priority),
                        addedAt: new Date(),
                        eligibilityScore: shipper.eligibilityScore,
                        distanceKm: distance
                    });
                }
            }
        }

        // Sort by priority (highest first)
        queuedShippers.sort((a, b) => b.priority - a.priority);

        // Store the queue
        this.shipperQueue.set(orderId, queuedShippers);

        this.logger.log(`📋 Created shipper queue for order ${orderId} with ${queuedShippers.length} eligible shippers`);
        
        if (queuedShippers.length > 0) {
            this.logger.log(`🏆 Top 3 shippers: ${queuedShippers.slice(0, 3).map(s => 
                `${s.shipperId}(${s.priority.toFixed(1)}, ${s.distanceKm.toFixed(1)}km)`
            ).join(', ')}`);
        }

        return queuedShippers;
    }

    /**
     * Lấy shipper tiếp theo (ưu tiên cao nhất) từ danh sách hàng đợi của đơn hàng (orderId).
     * Dùng khi muốn lấy ứng viên tốt nhất để tự động giao việc.
     */
    getNextShipperFromQueue(orderId: string): { shipperId: string; distance: number } | null {
        const queue = this.shipperQueue.get(orderId);
        if (!queue || queue.length === 0) {
            return null;
        }

        // Get the highest priority shipper
        const nextShipper = queue.shift();
        
        if (queue.length === 0) {
            this.shipperQueue.delete(orderId);
        }

        return nextShipper ? {
            shipperId: nextShipper.shipperId,
            distance: nextShipper.distanceKm
        } : null;
    }

    /**
     * Xóa đơn hàng khỏi mọi hàng đợi shipper (Dùng khi đơn vừa được nhận bởi 1 shipper hoặc bị hủy bỏ).
     */
    removeOrderFromQueues(orderId: string): void {
        this.shipperQueue.delete(orderId);
        this.logger.log(`🗑️ Removed order ${orderId} from shipper queues`);
    }

    /**
     * Loại bỏ một shipper khỏi danh sách hoạt động (active pool).
     * Sẽ đồng thời dọn dẹp shipper này khỏi mảng hàng đợi đang xếp.
     */
    async removeShipper(shipperId: string): Promise<void> {
        const removedShipper = this.activeShippers.get(shipperId);
        this.activeShippers.delete(shipperId);
        
        // Remove shipper from all order queues
        for (const [orderId, queue] of this.shipperQueue.entries()) {
            const filteredQueue = queue.filter(s => s.shipperId !== shipperId);
            if (filteredQueue.length === 0) {
                this.shipperQueue.delete(orderId);
            } else {
                this.shipperQueue.set(orderId, filteredQueue);
            }
        }

        // Update shipper's active status in database
        if (removedShipper) {
            try {
                const shipper = await this.userRepository.findOne({ where: { id: shipperId } });
                if (shipper) {
                    shipper.lastActiveAt = new Date();
                    await this.userRepository.save(shipper);
                }
            } catch (error) {
                this.logger.error(`Error updating shipper ${shipperId} last active time: ${error.message}`);
            }
        }
        
        this.logger.log(`🔌 Shipper ${shipperId} removed from active pool and queues`);
    }

    /**
     * Lấy các số liệu thống kê đầy đủ về shipper (số lượng active, điểm trung bình, trạng thái đơn...).
     * Hữu ích cho Dashboard quản trị hoặc Log giám sát.
     */
    getShipperStats() {
        const activeCount = this.activeShippers.size;
        const queuedOrdersCount = this.shipperQueue.size;
        
        const shippersByScore = Array.from(this.activeShippers.values())
            .sort((a, b) => b.eligibilityScore - a.eligibilityScore);

        // Calculate average metrics
        const allShippers = Array.from(this.activeShippers.values());
        const avgScore = allShippers.length > 0 ? 
            allShippers.reduce((sum, s) => sum + s.eligibilityScore, 0) / allShippers.length : 0;
        
        const avgActiveDeliveries = allShippers.length > 0 ?
            allShippers.reduce((sum, s) => sum + s.user.activeDeliveries, 0) / allShippers.length : 0;

        return {
            activeShippers: activeCount,
            queuedOrders: queuedOrdersCount,
            averageScore: Math.round(avgScore * 100) / 100,
            averageActiveDeliveries: Math.round(avgActiveDeliveries * 100) / 100,
            topShippers: shippersByScore.slice(0, 5).map(s => ({
                id: s.shipperId,
                score: s.eligibilityScore,
                activeDeliveries: s.user.activeDeliveries,
                completedDeliveries: s.user.completedDeliveries,
                rating: s.user.averageRating,
                completionRate: s.user.completedDeliveries + s.user.failedDeliveries > 0 ?
                    ((s.user.completedDeliveries / (s.user.completedDeliveries + s.user.failedDeliveries)) * 100).toFixed(1) + '%' : 'N/A'
            })),
            distributionByActiveDeliveries: this.getActiveDeliveryDistribution(allShippers)
        };
    }

    /**
     * Lấy phân bổ số lượng shipper dựa trên số đơn hàng họ đang giao.
     * Để biết hệ thống có bao nhiêu shipper rảnh (0 đơn), bận vừa (1-2 đơn) hay quá tải (3+ đơn).
     */
    private getActiveDeliveryDistribution(shippers: EligibleShipper[]) {
        const distribution = {
            '0': 0,
            '1': 0,
            '2': 0,
            '3+': 0
        };

        shippers.forEach(shipper => {
            const active = shipper.user.activeDeliveries;
            if (active === 0) distribution['0']++;
            else if (active === 1) distribution['1']++;
            else if (active === 2) distribution['2']++;
            else distribution['3+']++;
        });

        return distribution;
    }

    /**
     * Định kỳ dọn dẹp (Cleanup) các shipper đã offline quá lâu (5 phút ko cập nhật trạng thái)
     * và các mảng hàng đợi đơn (queue entries) lưu trữ quá thời gian (30 phút).
     */
    async cleanup(): Promise<void> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        let removedShippers = 0;
        let removedQueueEntries = 0;

        // Remove inactive shippers
        for (const [shipperId, shipper] of this.activeShippers.entries()) {
            if (shipper.lastSeen < fiveMinutesAgo) {
                await this.removeShipper(shipperId);
                removedShippers++;
            }
        }

        // Remove old queue entries
        for (const [orderId, queue] of this.shipperQueue.entries()) {
            const validQueue = queue.filter(s => s.addedAt > thirtyMinutesAgo);
            
            if (validQueue.length === 0) {
                this.shipperQueue.delete(orderId);
                removedQueueEntries++;
            } else if (validQueue.length !== queue.length) {
                this.shipperQueue.set(orderId, validQueue);
                removedQueueEntries += (queue.length - validQueue.length);
            }
        }

        if (removedShippers > 0 || removedQueueEntries > 0) {
            this.logger.debug(`🧹 Cleanup completed. Removed ${removedShippers} inactive shippers, ${removedQueueEntries} old queue entries. Active: ${this.activeShippers.size} shippers, ${this.shipperQueue.size} queued orders`);
        }
    }

    /**
     * Hàm phụ trợ lấy chi tiết thông tin 1 đơn hàng theo ID.
     */
    private async getOrderById(orderId: string): Promise<Order | null> {
        // This should be injected from OrderService
        // For now, we'll return null and handle in the calling method
        return null;
    }

    getAllShippers() {
        return Array.from(this.activeShippers.values());
    }

    cleanupInactiveShippers() {
        this.cleanup();
    }

    /**
     * Cleanup resources when destroying the tracker
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Singleton instance - will be initialized in the resolver
let activeShipperTracker: ActiveShipperTracker | null = null;

@Resolver(() => Order)
export class OrderResolver {
    private readonly logger = new Logger(OrderResolver.name);

    constructor(
        private systemConstraintsService: SystemConstraintsService,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Review)
        private reviewRepository: Repository<Review>,
    ) {
        // Initialize singleton if not already created
        if (!activeShipperTracker) {
            activeShipperTracker = new ActiveShipperTracker(
                this.systemConstraintsService,
                this.userRepository,
                this.reviewRepository
            );
        } else {
            // Re-initialize with current dependencies
            activeShipperTracker.initialize(
                this.systemConstraintsService,
                this.userRepository,
                this.reviewRepository
            );
        }
    }

    // Gửi thông báo real-time (Subscription) về đơn hàng mới tới ứng dụng của nhà hàng
    @Subscription(() => Order, {
        filter: (payload, variables, context) => {
            // Lọc ra đúng đơn hàng thuộc về nhà hàng (restaurantId) được yêu cầu và trạng thái 'pending'
            return (
                payload.orderCreated.restaurant.id === variables.restaurantId &&
                payload.orderCreated.status === 'pending' 
            );
        },
        resolve: (payload) => payload.orderCreated
    })
    orderCreated(
        @Args('restaurantId') restaurantId: string,
        @Context() context
    ) {
        if (!restaurantId) {
            throw new Error('restaurantId is required for orderCreated subscription');
        }
        return (pubSub).asyncIterableIterator('orderCreated');
    }

    // Gửi thông báo real-time tới ứng dụng của người mua (User) khi trạng thái đơn phát có cập nhật mới
    @Subscription(() => Order, {
        filter: (payload, variables, context) => {
            // Chỉ gửi thông báo nếu đơn hàng thuộc về đúng userId và nằm trong các trạng thái cần theo dõi
            return (
                payload.orderStatusUpdated.user.id === variables.userId  &&
                ['confirmed', 'delivering', 'shipper_received', 'completed', 'canceled'].includes(payload.orderStatusUpdated.status)
            );
        },
        resolve: (payload) => payload.orderStatusUpdated
    })
    orderStatusUpdated(
        @Args('userId') userId: string,
        @Context() context
    ) {
        if (!userId) {
            throw new Error('userId is required for orderStatusUpdated subscription');
        }
        return (pubSub).asyncIterableIterator('orderStatusUpdated');
    }

    // Subscription gửi thông tin đơn hàng đã xác nhận đến đúng shipper được chỉ định (kèm chi tiết doanh thu, quãng đường)
    @Subscription(() => Order, {
        filter: (payload, variables, context) => {
            const logger = new Logger('OrderSubscriptionFilter');
            const order = payload.orderConfirmedForShippers;
            const targetShipperId = payload.targetShipperId; // ID của shipper được hệ thống quyết định gán đơn
            const currentShipperId = variables.shipperId;    // ID của shipper đang kết nối nhận thông báo
            
            logger.log(`🎯 Target shipper: ${targetShipperId}, Current shipper: ${currentShipperId}`);
            
            // Chỉ gửi thông báo đi nếu:
            // 1) Đơn hàng đã được xác nhận, 2) Đơn hàng chưa có shipper nhận, 3) Shipper nhận thông báo chính là shipper mục tiêu
            const shouldSend = (
                order.status === 'confirmed' &&
                !order.shippingDetail &&
                targetShipperId === currentShipperId
            );

            if (shouldSend) {
                const earnings = order.shipperEarnings || 0;
                const distance = order.deliveryDistance || payload.distanceKm || 0;
                logger.log(`📦 Sending order ${order.id} to shipper ${currentShipperId} (Distance: ${distance.toFixed(2)}km, Earnings: ${earnings.toLocaleString()}đ)`);
            }

            return shouldSend;
        },
        resolve: (payload) => {
            const order = payload.orderConfirmedForShippers;
            
            // Calculate enhanced shipping information
            const shippingFee = order.shippingFee || 0;
            const shipperEarnings = order.shipperEarnings || Math.round(shippingFee * (order.shipperCommissionRate || 0.8));
            const platformFee = shippingFee - shipperEarnings;
            const distance = order.deliveryDistance || payload.distanceKm || 0;
            const earningsPerKm = distance > 0 ? Math.round(shipperEarnings / distance) : 0;
            
            // Enhanced order with comprehensive delivery and earnings metadata
            return {
                ...order,
                // Ensure earnings are calculated if missing
                shipperEarnings: shipperEarnings,
                deliveryMetadata: {
                    distanceKm: distance,
                    priorityScore: payload.priorityScore,
                    assignedAt: new Date(),
                    shippingInfo: {
                        totalDistance: distance,
                        shippingFee: shippingFee,
                        shipperEarnings: shipperEarnings,
                        platformFee: platformFee,
                        shipperCommissionRate: order.shipperCommissionRate || 0.8,
                        estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
                        earningsBreakdown: {
                            baseShippingFee: shippingFee,
                            shipperShare: shipperEarnings,
                            platformShare: platformFee,
                            commissionRate: `${((order.shipperCommissionRate || 0.8) * 100).toFixed(0)}%`,
                            earningsPerKm: earningsPerKm,
                            fuelCostEstimate: Math.round(distance * 500), // 3,000đ per km
                            netEarnings: Math.max(0, shipperEarnings - (distance * 3000))
                        },
                        deliveryDetails: {
                            restaurantToCustomer: `${distance.toFixed(1)}km`,
                            estimatedTime: `${order.estimatedDeliveryTime || 30} phút`,
                            deliveryType: order.deliveryType || 'asap',
                            requestedTime: order.requestedDeliveryTime || null,
                            urgency: order.deliveryType === 'scheduled' ? 'low' : 'medium'
                        },
                        financialSummary: {
                            grossEarnings: `${shipperEarnings.toLocaleString()}đ`,
                            estimatedFuelCost: `${Math.round(distance * 500).toLocaleString()}đ`,
                            netProfit: `${Math.max(0, shipperEarnings - (distance * 3000)).toLocaleString()}đ`,
                            profitMargin: shippingFee > 0 ? `${(((shipperEarnings - (distance * 3000)) / shippingFee) * 100).toFixed(1)}%` : '0%',
                            isProfitable: shipperEarnings > (distance * 3000)
                        }
                    }
                }
            };
        }
    })
    async orderConfirmedForShippers(
        @Args('shipperId') shipperId: string,
        @Args('latitude') latitude: string,
        @Args('longitude') longitude: string,
        @Args('maxDistance', { nullable: true, defaultValue: 20 }) maxDistance: number,
        @Context() context
    ) {
        this.logger.log(`🔗 Shipper ${shipperId} attempting to subscribe with location ${latitude}, ${longitude}`);
        
        if (!shipperId || !latitude || !longitude) {
            throw new Error('Shipper ID, latitude and longitude are required');
        }
        
        if (!activeShipperTracker) {
            throw new Error('ActiveShipperTracker not initialized');
        }
        
        // Add shipper with full constraint validation
        const result = await activeShipperTracker.addShipper(
            shipperId,
            parseFloat(latitude),
            parseFloat(longitude),
            maxDistance
        );

        if (!result.success) {
            this.logger.warn(`❌ Shipper ${shipperId} subscription rejected: ${result.message}`);
            throw new Error(`Subscription rejected: ${result.message}`);
        }
        
        this.logger.log(`✅ Shipper ${shipperId} subscribed successfully with score ${result.score}`);
        return (pubSub).asyncIterableIterator('orderConfirmedForShippers');
    }

    /**
     * API GraphQL (Query) lấy thống kê toàn diện cấu trúc nội bộ của hệ thống điều phối, 
     * trả về dưới dạng JSON String cho admin theo dõi số Shipper, trạng thái đơn hiện hành.
     */
    @Query(() => String)
    async getShipperStats() {
        if (!activeShipperTracker) {
            return JSON.stringify({ error: 'ActiveShipperTracker not initialized' });
        }
        const stats = activeShipperTracker.getShipperStats();
        return JSON.stringify(stats, null, 2);
    }

    /**
     * API GraphQL (Query) giúp tìm "Ứng viên tốt nhất" dựa trên điểm giả lập từ vị trí được truyền lên.
     * Để admin API kiểm tra log, tính logic ưu tiên của thuật toán.
     */
    @Query(() => String)
    async findBestShipperForLocation(
        @Args('latitude') latitude: number,
        @Args('longitude') longitude: number,
        @Args('orderValue', { nullable: true, defaultValue: 0 }) orderValue: number,
        @Args('urgency', { nullable: true, defaultValue: 'medium' }) urgency: string
    ) {
        if (!activeShipperTracker) {
            return JSON.stringify({ error: 'ActiveShipperTracker not initialized' });
        }
        
        const result = await activeShipperTracker.findBestShipperForOrder(
            latitude,
            longitude,
            orderValue,
            urgency as 'low' | 'medium' | 'high'
        );
        
        return JSON.stringify(result);
    }

    /**
     * Gọi API (Query) để trích xuất danh sách shipper ưu tiên (Queue) cho 1 OrderID riêng biệt.
     * Hữu dụng cho việc support hoặc Debug.
     */
    @Query(() => String)
    async getShipperQueueStatus(@Args('orderId') orderId: string) {
        if (!activeShipperTracker) {
            return JSON.stringify({ error: 'ActiveShipperTracker not initialized' });
        }
        
        const stats = activeShipperTracker.getShipperStats();
        return JSON.stringify({ orderId, ...stats });
    }

    /**
     * Bật thủ công quá trình Dọn dẹp (Cleanup) nhằm giải phóng bộ nhớ (dành riêng cho Admin).
     */
    @Query(() => String)
    async triggerShipperCleanup() {
        if (!activeShipperTracker) {
            return 'ActiveShipperTracker not initialized';
        }
        
        await activeShipperTracker.cleanup();
        return 'Cleanup completed';
    }

    @Query(() => String)
    orderHello() {
        return 'Order resolver is working with enhanced shipper tracking!';
    }
}

// Export the singleton instance directly for global use
export { activeShipperTracker, ActiveShipperTracker };

// Keep the factory function for backward compatibility
function getActiveShipperTracker(): ActiveShipperTracker | null {
    return activeShipperTracker;
}

export { getActiveShipperTracker };