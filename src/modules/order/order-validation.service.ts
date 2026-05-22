import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import { CreateOrderDetailDto } from './dto/create-order.dto';
import {
  ValidatedOrderContext,
  ValidatedOrderDetailsResult,
} from './dto/order-calculation.types';

@Injectable()
export class OrderValidationService {
  private readonly logger = new Logger(OrderValidationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
    @InjectRepository(Topping)
    private readonly toppingRepository: Repository<Topping>,
  ) {}

  validateOrderHasItems(orderDetails?: CreateOrderDetailDto[]): void {
    if (!orderDetails || orderDetails.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }
  }

  async validateOrderContext(
    userId: string,
    restaurantId: string,
    addressId: string,
  ): Promise<ValidatedOrderContext> {
    const [user, restaurant, address] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.restaurantRepository.findOne({
        where: { id: restaurantId },
        relations: ['address'],
      }),
      this.addressRepository.findOne({ where: { id: addressId } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!restaurant || !restaurant.address) {
      throw new NotFoundException('Restaurant or its address not found');
    }
    if (!address) {
      throw new NotFoundException('Delivery address not found');
    }

    return { user, restaurant, address };
  }

  async validateAddressAndRestaurant(
    addressId: string,
    restaurantId: string,
  ): Promise<{
    address: Address;
    restaurant: Restaurant;
  }> {
    const [address, restaurant] = await Promise.all([
      this.addressRepository.findOne({ where: { id: addressId } }),
      this.restaurantRepository.findOne({
        where: { id: restaurantId },
        relations: ['address'],
      }),
    ]);

    if (!address || !restaurant || !restaurant.address) {
      throw new Error('Invalid address or restaurant');
    }

    return { address, restaurant };
  }

  async validateRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
      relations: ['address'],
    });

    if (!restaurant || !restaurant.address) {
      throw new Error('Invalid restaurant');
    }

    return restaurant;
  }

  validateCoordinates(
    address: Address,
    restaurant: Restaurant,
    userId?: string,
  ): {
    userLat: number;
    userLng: number;
    restaurantLat: number;
    restaurantLng: number;
  } {
    this.logger.log('=== MAPBOX ROUTE CALCULATION ===');
    this.logger.log(
      `User Address: ${address.street}, ${address.ward}, ${address.district}`,
    );
    this.logger.log(
      `User Coordinates: ${address.latitude}, ${address.longitude}`,
    );
    this.logger.log(`Restaurant: ${restaurant.name}`);
    this.logger.log(
      `Restaurant Coordinates: ${restaurant.address.latitude}, ${restaurant.address.longitude}`,
    );

    if (address.latitude === null || address.longitude === null) {
      this.logger.error(
        `Address coordinates are null. Address ID: ${address.id}, User ID: ${userId}`,
      );
      throw new BadRequestException(
        'Delivery address coordinates are missing. Please select a valid address or provide coordinates.',
      );
    }

    if (
      restaurant.address.latitude === null ||
      restaurant.address.longitude === null
    ) {
      this.logger.error(
        `Restaurant coordinates are null. Restaurant ID: ${restaurant.id}`,
      );
      throw new BadRequestException(
        'Restaurant coordinates are missing. Please contact support.',
      );
    }

    const userLat = Number(address.latitude);
    const userLng = Number(address.longitude);
    const restaurantLat = Number(restaurant.address.latitude);
    const restaurantLng = Number(restaurant.address.longitude);

    if (
      isNaN(userLat) ||
      isNaN(userLng) ||
      Math.abs(userLat) > 90 ||
      Math.abs(userLng) > 180
    ) {
      this.logger.error(
        `Invalid user coordinates: lat=${userLat}, lng=${userLng}`,
      );
      throw new BadRequestException(
        `Invalid user coordinates: lat=${userLat}, lng=${userLng}`,
      );
    }
    if (
      isNaN(restaurantLat) ||
      isNaN(restaurantLng) ||
      Math.abs(restaurantLat) > 90 ||
      Math.abs(restaurantLng) > 180
    ) {
      this.logger.error(
        `Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
      );
      throw new BadRequestException(
        `Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
      );
    }

    return { userLat, userLng, restaurantLat, restaurantLng };
  }

  validateScheduledDelivery(
    deliveryType: string | undefined,
    requestedDeliveryTime: number | undefined,
    maxDeliveryTimeMinutes: number,
  ): {
    requestedDeliveryTime: string | undefined;
    estimatedDeliveryTime?: number;
  } {
    if (deliveryType !== 'scheduled' || !requestedDeliveryTime) {
      return { requestedDeliveryTime: undefined };
    }

    if (requestedDeliveryTime > maxDeliveryTimeMinutes) {
      throw new BadRequestException(
        `Scheduled time cannot exceed ${maxDeliveryTimeMinutes} minutes.`,
      );
    }

    const requestedAt = new Date(Date.now() + requestedDeliveryTime * 60000);
    return {
      requestedDeliveryTime: requestedAt.toISOString(),
      estimatedDeliveryTime: requestedDeliveryTime,
    };
  }

  async validateAndCalculateOrderDetails(
    orderDetails: CreateOrderDetailDto[],
  ): Promise<ValidatedOrderDetailsResult> {
    const foodIds = [...new Set(orderDetails.map((detail) => detail.foodId))];
    const foods = await this.foodRepository.find({
      where: { id: In(foodIds) },
    });
    const foodsById = new Map(foods.map((food) => [food.id, food]));

    const selectedToppingIds = orderDetails.flatMap((detail) =>
      (detail.selectedToppings || []).map((topping) => topping.id),
    );
    const toppings = selectedToppingIds.length
      ? await this.toppingRepository.find({
          where: {
            id: In([...new Set(selectedToppingIds)]),
            isAvailable: true,
          },
          relations: ['food'],
        })
      : [];
    const toppingsById = new Map(
      toppings.map((topping) => [topping.id, topping]),
    );

    let calculatedTotal = 0;
    const foodDetails = orderDetails.map((detail) => {
      const food = foodsById.get(detail.foodId);
      if (!food) {
        throw new NotFoundException(`Food with ID ${detail.foodId} not found`);
      }

      const quantity = Number(detail.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for food ID ${detail.foodId}`,
        );
      }

      const basePrice = Number(food.price);
      const discountPercent =
        detail.discountPercent ?? food.discountPercent ?? 0;
      const discountedPrice = basePrice - (basePrice * discountPercent) / 100;

      let toppingTotal = 0;
      const validatedToppings = (detail.selectedToppings || []).map(
        (selectedTopping) => {
          const topping = toppingsById.get(selectedTopping.id);
          if (!topping || topping.food?.id !== detail.foodId) {
            throw new BadRequestException(
              `Topping ${selectedTopping.name} is not available for this food`,
            );
          }

          if (
            Math.abs(Number(topping.price) - Number(selectedTopping.price)) >
            0.01
          ) {
            throw new BadRequestException(
              `Invalid topping price for ${topping.name}`,
            );
          }

          toppingTotal += Number(topping.price) * quantity;
          return {
            id: topping.id,
            name: topping.name,
            price: Number(topping.price),
          };
        },
      );

      // Food discount is applied before topping totals, matching the previous order detail pricing.
      const itemTotal = discountedPrice * quantity + toppingTotal;
      calculatedTotal += itemTotal;

      return {
        food,
        quantity,
        selectedToppings: validatedToppings,
        toppingTotal,
        discountPercent,
        discountedPrice,
        itemTotal,
      };
    });

    this.logger.debug(
      `Calculated food total for order details: ${calculatedTotal}`,
    );
    return { calculatedTotal, foodDetails };
  }
}
