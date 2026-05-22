import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PendingShipperAssignment } from 'src/entities/pendingShipperAssignment.entity';
import { Order } from 'src/entities/order.entity';
import { QueueService } from 'src/queue/queue.service';
import { QueueNames, FindShipperJobData } from 'src/queue/queue.constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { pubSub } from 'src/pubsub';
import { haversineDistance } from 'src/common/utils/helper';
import { activeShipperTracker } from 'src/modules/order/order.resolver'; // Import the tracker

// Import the active shipper tracker
interface ActiveShipper {
    shipperId: string;
    latitude: number;
    longitude: number;
    maxDistance: number;
    lastSeen: Date;
}

/**
 * Class Tracker Nội Bộ để theo dõi tình trạng "Gửi Lời Mời Giao Hàng"
 * Giúp nhớ xem Shipper nào đã bị "hỏi" rồi, tránh việc 1 giây hỏi ông Shipper A tận 3 lần.
 * Đồng thời chứa bộ hẹn giờ (setTimeout) để chờ Shipper đó trả lời (Đồng ý/Từ chối).
 */
class ShipperNotificationTracker {
    private notifiedShippers: Map<string, Set<string>> = new Map(); // orderId -> log shipperIds
    private shipperResponseTimeout: Map<string, NodeJS.Timeout> = new Map(); // orderId -> timeout

    addNotifiedShipper(orderId: string, shipperId: string): void {
        if (!this.notifiedShippers.has(orderId)) {
            this.notifiedShippers.set(orderId, new Set());
        }
        this.notifiedShippers.get(orderId)!.add(shipperId);
    }

    hasBeenNotified(orderId: string, shipperId: string): boolean {
        return this.notifiedShippers.get(orderId)?.has(shipperId) || false;
    }

    clearOrder(orderId: string): void {
        this.notifiedShippers.delete(orderId);
        const timeout = this.shipperResponseTimeout.get(orderId);
        if (timeout) {
            clearTimeout(timeout);
            this.shipperResponseTimeout.delete(orderId);
        }
    }

    setResponseTimeout(orderId: string, callback: () => void, timeoutMs: number): void {
        const timeout = setTimeout(callback, timeoutMs);
        this.shipperResponseTimeout.set(orderId, timeout);
    }

    getNotifiedShippers(orderId: string): string[] {
        return Array.from(this.notifiedShippers.get(orderId) || []);
    }
}

/**
 * [NGƯỜI LÀM CÔNG - WORKER]
 * Trái tim của hệ thống tự động gán tài xế. 
 * Class này giữ logic nghiệp vụ gán shipper. BullMQ processor sẽ gọi vào service này khi có job.
 */
@Injectable()
export class PendingAssignmentService {
    private readonly logger = new Logger(PendingAssignmentService.name);
    private shipperTracker = new ShipperNotificationTracker();

    constructor(
        @InjectRepository(PendingShipperAssignment)
        private pendingAssignmentRepository: Repository<PendingShipperAssignment>,
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        private queueService: QueueService,
    ) {
        // this.logger.log('🏗️ PendingAssignmentService constructor called');
    }

    /**
     * Vòng lặp định kỳ (CRONTAB) tự quét Database để cứu cánh các đơn bị kẹt.
     * Cứ mỗi 5 giây, nó vào bảng `PendingShipperAssignment` (nơi lưu các đơn nằm chờ tài xế).
     * Lôi ra các đơn đã đến lượt (nextAttemptAt < Now) rồi tạo ra Job tống vào hàng chờ FIND_SHIPPER cho cái Worker phía trên chạy.
     */
    @Cron(CronExpression.EVERY_5_SECONDS)
    async checkPendingAssignmentsAndCreateJobs(): Promise<void> {
        // ... logs
        try {
            // Lôi từ Database ra tối đa 50 đơn hàng đang chờ tới lượt tìm tài xế xui xẻo
            const pendingAssignments = await this.pendingAssignmentRepository.find({
                where: {
                    nextAttemptAt: LessThan(new Date()) 
                },
                relations: ['order', 'order.restaurant', 'order.user', 'order.address', 'order.shippingDetail'],
                order: {
                    priority: 'DESC', // Ưu tiên các đơn có mác "Gấp" trước
                    createdAt: 'ASC'  // Cùng độ ưu tiên thì đơn nào nằm chờ lâu hơn giải quyết trước
                },
                take: 50
            });

            // this.logger.log(`📊 Found ${pendingAssignments.length} pending assignments in database`);

            if (pendingAssignments.length === 0) {
                // this.logger.log('✅ No pending assignments found in database');
                return;
            }

            // Process each pending assignment
            let jobsCreated = 0;
            let assignmentsRemoved = 0;

            for (const assignment of pendingAssignments) {
                try {
                    // Validate the order is still valid for assignment
                    const isValid = await this.validatePendingAssignment(assignment);
                    
                    if (!isValid) {
                        // Remove invalid assignment
                        await this.pendingAssignmentRepository.remove(assignment);
                        assignmentsRemoved++;
                        continue;
                    }

                    // Create a job to process this assignment
                    const jobId = await this.createJobForPendingAssignment(assignment);
                    
                    if (jobId) {
                        jobsCreated++;
                        // this.logger.log(`✅ Created job ${jobId} for pending assignment ${assignment.id}`);
                    }

                } catch (error) {
                    this.logger.error(`❌ Error processing pending assignment ${assignment.id}:`, error);
                }
            }

            // this.logger.log(`🎯 Daily check completed: ${jobsCreated} jobs created, ${assignmentsRemoved} invalid assignments removed`);

        } catch (error) {
            this.logger.error('❌ Error during daily pending assignments check:', error);
        }
    }

    /**
     * Get expired pending assignments based on their creation time
     */
    async getExpiredAssignments(cutoffDate: Date): Promise<PendingShipperAssignment[]> {
        // this.logger.log(`🔍 Looking for pending assignments created before ${cutoffDate.toISOString()}`);
        
        const expiredAssignments = await this.pendingAssignmentRepository.find({
            where: {
                createdAt: LessThan(cutoffDate)
            },
            relations: ['order', 'order.restaurant', 'order.shippingDetail'],
            order: {
                createdAt: 'ASC' // Oldest first
            }
        });

        // this.logger.log(`📊 Found ${expiredAssignments.length} expired pending assignments`);
        
        return expiredAssignments;
    }


    /**
     * Remove a pending assignment by assignment ID
     */
    async removePendingAssignmentById(assignmentId: string): Promise<boolean> {
        try {
            const assignment = await this.pendingAssignmentRepository.findOne({
                where: { id: assignmentId }
            });

            if (assignment) {
                await this.pendingAssignmentRepository.remove(assignment);
                // this.logger.log(`🗑️ Removed pending assignment ${assignmentId}`);
                return true;
            } else {
                // this.logger.log(`⚠️ Pending assignment ${assignmentId} not found`);
                return false;
            }
        } catch (error) {
            this.logger.error(`❌ Failed to remove pending assignment ${assignmentId}:`, error);
            return false;
        }
    }

    /**
     * Validate (Lớp bảo vệ) xem đơn này có còn ĐÁNG để đi tìm shipper ko.
     */
    private async validatePendingAssignment(assignment: PendingShipperAssignment): Promise<boolean> {
        const order = assignment.order;

        // 1. Phải là đơn đã "Confirmed" mới tìm người. Còn Cancel cmnr thì tìm gì nữa.
        if (!order || order.status !== 'confirmed') {
            return false;
        }

        // 2. Chẳng may đã có ông tài xế nào (shippingDetail) nhận đơn rồi thì bỏ qua.
        if (order.shippingDetail) {
            return false;
        }

        // 3. Nếu đang trong quá trình gán 1 cái "Giấy Mời" cho 1 shipper rồi và đang đợi trả lời,
        // thì đừng có đè tìm thêm ông khác cho rối chuyện.
        if (assignment.isSentToShipper == true)
        {
            return false;
        }

        // Check if assignment has exceeded maximum attempts or age based on assignment creation time
        const maxAttempts = 15;
        const maxAgeMinutes = 30; // 30 minutes from assignment creation
        const maxAge = maxAgeMinutes * 60 * 1000;
        const assignmentAge = Date.now() - this.getDatabaseTimestampMs(assignment.createdAt);
        const isExpired = assignmentAge > maxAge;

        if (assignment.attemptCount >= maxAttempts || isExpired) {
            const ageMinutes = Math.round(assignmentAge / (1000 * 60));
            // this.logger.log(`❌ Assignment ${assignment.id}: Exceeded max attempts (${assignment.attemptCount}) or expired (${ageMinutes} minutes old)`);
            return false;
        }

        return true;
    }

    /**
     * Create a job for a pending assignment to find and notify the nearest shipper
     */
    private async createJobForPendingAssignment(assignment: PendingShipperAssignment): Promise<string | null> {
        try {
            const jobData: FindShipperJobData = {
                pendingAssignmentId: assignment.id,
                orderId: assignment.order.id,
                attempt: assignment.attemptCount + 1
            };

            const jobOptions = {
                attempts: 3,
                backoffDelayMs: 5000,
                priority: assignment.priority,
                jobId: `find-shipper:${assignment.id}:${assignment.attemptCount + 1}`,
                removeOnComplete: true,
                removeOnFail: 1000,
            };

            const jobId = await this.queueService.addJob(
                QueueNames.FIND_SHIPPER,
                jobData,
                jobOptions
            );

            // this.logger.log(`📤 Queued job ${jobId} for assignment ${assignment.id}, order ${assignment.order.id}`);
            return jobId;

        } catch (error) {
            this.logger.error(`❌ Failed to create job for assignment ${assignment.id}:`, error);
            return null;
        }
    }

    /**
     * TRÁI TIM CỦA WORKER: Hàm chạy Logic chính cho 1 Job. 
     * Sẽ đi đo khoảng cách, tìm ông Shipper ngon nhất, rồi bắn PubSub báo Notification cho ổng.
     */
    async processShipperAssignmentJobData(jobId: string, data: FindShipperJobData): Promise<void> {
        if (!this.isValidJobData(data)) {
            this.logger.error(`❌ Received invalid job data: ${JSON.stringify(data)}`);
            throw new Error('Invalid job data');
        }

        const { pendingAssignmentId, orderId, attempt } = data;
        
        // this.logger.log(`🎯 === PROCESSING SHIPPER ASSIGNMENT FOR ORDER ${orderId} ===`);
        // this.logger.log(`🔄 Job ID: ${jobId}, Assignment ID: ${pendingAssignmentId}, Attempt: ${attempt}`);

        try {
            // Get the pending assignment and order details
            const assignment = await this.pendingAssignmentRepository.findOne({
                where: { id: pendingAssignmentId },
                relations: ['order', 'order.restaurant', 'order.user', 'order.address', 'order.orderDetails', 'order.orderDetails.food']
            });

            if (!assignment) {
                // this.logger.warn(`⚠️ Pending assignment ${pendingAssignmentId} not found`);
                return;
            }

            const order = assignment.order;

            // Validate order is still assignable
            if (order.status !== 'confirmed') {
                // this.logger.log(`❌ Order ${orderId} status changed to ${order.status}, removing assignment`);
                await this.pendingAssignmentRepository.remove(assignment);
                this.shipperTracker.clearOrder(orderId);
                return;
            }

            // Check if already assigned
            const currentOrder = await this.orderRepository.findOne({
                where: { id: orderId },
                relations: ['shippingDetail']
            });

            if (currentOrder?.shippingDetail) {
                // this.logger.log(`✅ Order ${orderId} already assigned, removing from pending`);
                await this.pendingAssignmentRepository.remove(assignment);
                this.shipperTracker.clearOrder(orderId);
                return;
            }

            // Find the nearest available shipper
            const nearestShipper = await this.findNearestAvailableShipper(order);
            
            if (!nearestShipper) {
                // this.logger.log(`😞 No available shippers found for order ${orderId}, scheduling retry...`);
                // Don't change isSentToShipper when no shippers available
                await this.scheduleRetryForAssignment(assignment);
                return;
            }

            // Only proceed with notification and database update if we have a shipper
            // this.logger.log(`📡 Notifying shipper ${nearestShipper.shipperId} about order ${orderId}...`);

            // Calculate earnings info before sending
            const shippingFee = order.shippingFee || 0;
            const shipperEarnings = order.shipperEarnings || Math.round(shippingFee * 0.8);
            const distance = order.deliveryDistance || 0;

            await pubSub.publish('orderConfirmedForShippers', {
                orderConfirmedForShippers: {
                    ...order,
                    // Ensure earnings are included
                    shipperEarnings: shipperEarnings,
                    shippingFee: shippingFee
                },
                targetShipperId: nearestShipper.shipperId,
                distanceKm: distance,
                priorityScore: assignment.priority,
                earningsInfo: {
                    shippingFee,
                    shipperEarnings,
                    platformFee: shippingFee - shipperEarnings,
                    netProfit: Math.max(0, shipperEarnings - (distance * 3000)),
                    earningsPerKm: distance > 0 ? Math.round(shipperEarnings / distance) : 0
                }
            });

            // Only update isSentToShipper AFTER successfully publishing
            assignment.isSentToShipper = true;
            await this.pendingAssignmentRepository.save(assignment);

            // Track that this shipper was notified
            this.shipperTracker.addNotifiedShipper(orderId, nearestShipper.shipperId);
            
            // this.logger.log(`✅ Notified shipper ${nearestShipper.shipperId} about order ${orderId}`);

            // Set timeout for shipper response (e.g., 2 minutes)
            this.shipperTracker.setResponseTimeout(orderId, async () => {
                // this.logger.log(`⏰ Shipper ${nearestShipper.shipperId} didn't respond to order ${orderId}, trying next shipper...`);
                
                try {
                    // Fetch the latest assignment data to avoid stale entity issues
                    const latestAssignment = await this.pendingAssignmentRepository.findOne({
                        where: { id: assignment.id },
                        relations: ['order']
                    });
                    
                    if (!latestAssignment) {
                        // this.logger.warn(`⚠️ Assignment ${assignment.id} not found for retry`);
                        return;
                    }
                    
                    // Reset the flag to allow finding another shipper
                    latestAssignment.isSentToShipper = false;
                    await this.pendingAssignmentRepository.save(latestAssignment);
                    
                    // Schedule retry with the fresh assignment data
                    await this.scheduleRetryForAssignment(latestAssignment);
                    
                } catch (error) {
                    this.logger.error(`❌ Error handling shipper timeout for assignment ${assignment.id}:`, error);
                    
                    // If there's an error, try to clean up by removing the assignment
                    try {
                        const assignmentToRemove = await this.pendingAssignmentRepository.findOne({
                            where: { id: assignment.id }
                        });
                        if (assignmentToRemove) {
                            await this.pendingAssignmentRepository.remove(assignmentToRemove);
                            // this.logger.log(`🗑️ Removed problematic assignment ${assignment.id} after timeout error`);
                        }
                    } catch (cleanupError) {
                        this.logger.error(`💥 Failed to cleanup assignment ${assignment.id}:`, cleanupError);
                    }
                }
            }, 2 * 60 * 1000); // 2 minutes

            // this.logger.log(`🎯 === COMPLETED PROCESSING FOR ORDER ${orderId} ===`);

        } catch (error) {
            this.logger.error(`💥 Error processing shipper assignment job ${jobId}:`, error);
            
            // Update assignment attempt count on error (but don't change isSentToShipper)
            try {
                const assignment = await this.pendingAssignmentRepository.findOne({
                    where: { id: pendingAssignmentId }
                });
                if (assignment) {
                    await this.scheduleRetryForAssignment(assignment);
                }
            } catch (updateError) {
                this.logger.error(`💥 Failed to update assignment after error:`, updateError);
            }
            
            throw error;
        }
    }

    /**
     * Nhờ cục ActiveShipperTracker (từ order.resolver) đưa ra danh sách các shipper
     * và chọn ra người ngon nhất, thỏa mãn điều kiện và... chưa được gọi lần nào.
     */
    private async findNearestAvailableShipper(order: Order): Promise<ActiveShipper | null> {
        if (!order.restaurant?.latitude || !order.restaurant?.longitude) {
            // this.logger.warn(`❌ Order ${order.id} restaurant has no coordinates`);
            return null;
        }

        const restaurantLat = parseFloat(order.restaurant.latitude.toString());
        const restaurantLng = parseFloat(order.restaurant.longitude.toString());
        const alreadyNotified = this.shipperTracker.getNotifiedShippers(order.id);

        let nearestShipper: ActiveShipper | null = null;
        let shortestDistance = Infinity;

        // Check if activeShipperTracker is available - ADD THIS NULL CHECK!
        if (!activeShipperTracker) {
            // this.logger.warn(`❌ ActiveShipperTracker not available`);
            return null;
        }

        // Get active shippers from the resolver's tracker
        const activeShippers = activeShipperTracker.getAllShippers();
        // this.logger.log(`📋 Found ${activeShippers.length} active shippers from resolver tracker`);

        // Debug: Log all active shippers
        // activeShippers.forEach(shipper => {
        //     this.logger.log(`👤 Active shipper: ${shipper.shipperId} at lat=${shipper.latitude}, lng=${shipper.longitude}, maxDistance=${shipper.maxDistance}`);
        // });

        for (const shipper of activeShippers) {
            // Skip shippers already notified about this order
            if (alreadyNotified.includes(shipper.shipperId)) {
                // this.logger.log(`⏭️ Skipping shipper ${shipper.shipperId} - already notified`);
                continue;
            }

            const distance = haversineDistance(
                shipper.latitude,
                shipper.longitude,
                restaurantLat,
                restaurantLng
            );

            // this.logger.log(`📏 Shipper ${shipper.shipperId} distance: ${distance}km (max: ${shipper.maxDistance}km)`);

            if (distance <= shipper.maxDistance && distance < shortestDistance) {
                shortestDistance = distance;
                nearestShipper = {
                    shipperId: shipper.shipperId,
                    latitude: shipper.latitude,
                    longitude: shipper.longitude,
                    maxDistance: shipper.maxDistance,
                    lastSeen: shipper.lastSeen
                };
            }
        }

        if (nearestShipper) {
            // this.logger.log(`🎯 Selected shipper ${nearestShipper.shipperId} at ${shortestDistance.toFixed(2)}km distance`);
        } else {
            // this.logger.log(`😞 No suitable shippers found for order ${order.id}`);
        }

        return nearestShipper;
    }

    /**
     * Clean up notification tracking when order is assigned
     */
    async onOrderAssigned(orderId: string): Promise<void> {
        this.shipperTracker.clearOrder(orderId);
        // this.logger.log(`🎉 Order ${orderId} assigned, cleared notification tracking`);
    }

    /**
     * Lập lịch để TÌM LẠI shipper (Retry) nếu lần trước tìm thất bại (do từ chối hoặc bận hết).
     * Dùng thuật toán Exponential Backoff: Lần 1 đợi 1 phút, lần 2 đợi 2 phút, lần 3 đợi 4 phút...
     * Cứ thế cho đến khi chạm mốc 10 lần thử hoặc hết 60 phút thì bỏ cuộc xóa luôn đơn.
     */
    private async scheduleRetryForAssignment(assignment: PendingShipperAssignment): Promise<void> {
        const maxRetries = 10;
        const baseDelay = 1; // 1 minute base delay
        
        if (assignment.attemptCount >= maxRetries) {
            // this.logger.warn(`🚫 Max retries (${maxRetries}) reached for assignment ${assignment.id}, removing from queue`);
            
            try {
                await this.pendingAssignmentRepository.remove(assignment);
                // this.logger.log(`🗑️ Removed assignment ${assignment.id} after max retries`);
            } catch (error) {
                this.logger.error(`❌ Failed to remove assignment ${assignment.id}:`, error);
            }
            
            return;
        }

        // Calculate exponential backoff delay
        const delayMinutes = Math.min(baseDelay * Math.pow(2, assignment.attemptCount), 60); // Max 60 minutes
        const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000);

        try {
            // Fetch the latest assignment to avoid working with stale data
            const latestAssignment = await this.pendingAssignmentRepository.findOne({
                where: { id: assignment.id },
                relations: ['order']
            });

            if (!latestAssignment) {
                // this.logger.warn(`⚠️ Assignment ${assignment.id} not found for retry scheduling`);
                return;
            }

            // Update the existing assignment instead of creating a new one
            latestAssignment.attemptCount += 1;
            latestAssignment.lastAttemptAt = new Date();
            latestAssignment.nextAttemptAt = nextAttempt;
            // Don't reset isSentToShipper here - let it remain as is
            // Only reset when we actually find a new shipper to notify

            await this.pendingAssignmentRepository.save(latestAssignment);
            
            // this.logger.log(`🔄 Scheduled retry ${latestAssignment.attemptCount}/${maxRetries} for assignment ${assignment.id} in ${delayMinutes} minutes (next attempt: ${nextAttempt.toISOString()})`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to schedule retry for assignment ${assignment.id}:`, error);
            
            // If updating fails, try to remove the assignment to prevent further errors
            try {
                const assignmentToRemove = await this.pendingAssignmentRepository.findOne({
                    where: { id: assignment.id }
                });
                if (assignmentToRemove) {
                    await this.pendingAssignmentRepository.remove(assignmentToRemove);
                    // this.logger.log(`🗑️ Removed problematic assignment ${assignment.id}`);
                }
            } catch (removeError) {
                this.logger.error(`💥 Failed to remove problematic assignment ${assignment.id}:`, removeError);
            }
        }
    }

    /**
     * Type guard to validate job data
     */
    private isValidJobData(data: unknown): data is FindShipperJobData {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const job = data as any;
        return (
            typeof job.pendingAssignmentId === 'string' &&
            typeof job.orderId === 'string' &&
            typeof job.attempt === 'number'
        );
    }

    /**
     * Utility method to add delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getDatabaseTimestampMs(value: Date): number {
        return value.getTime() - value.getTimezoneOffset() * 60 * 1000;
    }

    // ===============================
    // EXISTING METHODS (kept for backward compatibility)
    // ===============================

    /**
     * Được gọi ở bên file khác (như order.service) khi đơn hàng vừa được nhà hàng xác nhận (Confirmed).
     * Sẽ tống đơn hàng này vào bảng tạm PendingShipperAssignment để thằng Worker bắt đầu quy trình đi tìm Shipper.
     */
    async addPendingAssignment(orderId: string, priority: number = 1): Promise<PendingShipperAssignment> {
        // this.logger.log(`🚀 Adding pending assignment for order ${orderId} with priority ${priority}`);

        try {
            // Check if assignment already exists
            const existing = await this.pendingAssignmentRepository.findOne({
                where: { order: { id: orderId } }
            });

            if (existing) {
                // this.logger.warn(`⚠️ Pending assignment already exists for order ${orderId}`);
                return existing;
            }

            // Validate order
            const order = await this.validateOrderForAssignment(orderId);

            // Create pending assignment
            const assignment = await this.createPendingAssignment(order, priority);

            // this.logger.log(`✅ Created pending assignment ${assignment.id} for order ${orderId}`);
            
            return assignment;
        } catch (error) {
            this.logger.error(`❌ Failed to add pending assignment for order ${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Validates that an order can be assigned to a shipper
     */
    private async validateOrderForAssignment(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: ['restaurant', 'user', 'address', 'orderDetails', 'orderDetails.food', 'shippingDetail']
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        if (order.status !== 'confirmed') {
            throw new Error(`Order ${orderId} is not confirmed (status: ${order.status})`);
        }

        if (order.shippingDetail) {
            throw new Error(`Order ${orderId} is already assigned to a shipper`);
        }

        return order;
    }

    /**
     * Creates a pending assignment record in the database
     */
    private async createPendingAssignment(order: Order, priority: number): Promise<PendingShipperAssignment> {
        const pendingAssignment = this.pendingAssignmentRepository.create({
            order,
            priority,
            attemptCount: 0,
            nextAttemptAt: new Date(), // Try immediately
            isSentToShipper: false,
        });

        const saved = await this.pendingAssignmentRepository.save(pendingAssignment);
        // this.logger.log(`✅ Saved pending assignment ${saved.id} for order ${order.id}`);

        return saved;
    }

    /**
     * Remove pending assignment when order is assigned
     */
    async removePendingAssignment(orderId: string): Promise<void> {
        // this.logger.log(`🗑️ Removing pending assignment for order ${orderId}`);
        
        const result = await this.pendingAssignmentRepository.delete({
            order: { id: orderId }
        });

        if (result.affected && result.affected > 0) {
            // this.logger.log(`✅ Removed pending assignment for order ${orderId}`);
        } else {
            // this.logger.warn(`⚠️ No pending assignment found to remove for order ${orderId}`);
        }
    }

    /**
     * CRONTAB: Chạy tự động MỖI GIỜ MỘT LẦN.
     * Quét bảng PendingShipperAssignment và xóa nó hết mấy đơn bị treo quá 48 tiếng (2 ngày).
     * (Vd: Quán từ chối đóng cửa, khách bom hàng, hoặc chả có shipper nào nhận nhưng hệ thống lỗi kẹt lại).
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupExpiredAssignments(): Promise<void> {
        // this.logger.log('🧹 Running cleanup of expired pending assignments...');
        
        const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

        const result = await this.pendingAssignmentRepository.delete({
            createdAt: LessThan(cutoffTime)
        });

        if (result.affected && result.affected > 0) {
            // this.logger.log(`🗑️ Cleaned up ${result.affected} expired pending assignments`);
        } else {
            // this.logger.log('✅ No expired pending assignments to clean up');
        }
    }

    /**
     * Get statistics about the pending assignment system
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async logSystemStats(): Promise<void> {
        try {
            const dbPendingCount = await this.pendingAssignmentRepository.count();
            const queueSize = await this.queueService.getQueueSize(QueueNames.FIND_SHIPPER);
            
            // this.logger.log(`📊 System Stats: ${dbPendingCount} pending assignments in DB, ${queueSize} jobs in queue`);
            
            if (dbPendingCount > 0) {
                const readyToProcess = await this.pendingAssignmentRepository.count({
                    where: { nextAttemptAt: LessThan(new Date()) }
                });
                // this.logger.log(`⏰ ${readyToProcess} assignments ready for processing`);
            }
        } catch (error) {
            this.logger.error('❌ Error collecting system stats:', error);
        }
    }

}
