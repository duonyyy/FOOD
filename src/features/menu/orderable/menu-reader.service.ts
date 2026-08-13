import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Repository } from 'typeorm';
import {
  type GetOrderableItemsRequest,
  type MenuReaderPort,
  type OrderableItemSnapshot,
  type OrderableToppingSnapshot,
} from '../contracts/menu-reader.port';

/** Catalog read boundary for Ordering. It returns frozen plain data, never entities. */
@Injectable()
export class MenuReaderService implements MenuReaderPort {
  constructor(@InjectRepository(Food) private readonly foodRepository: Repository<Food>) {}

  async getOrderableItems(request: GetOrderableItemsRequest): Promise<OrderableItemSnapshot[]> {
    return Promise.all(
      request.items.map((item) => this.toSnapshot(item.foodId, item.toppingIds ?? [])),
    );
  }

  private async toSnapshot(foodId: string, toppingIds: string[]): Promise<OrderableItemSnapshot> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
      relations: ['restaurant', 'toppings'],
    });
    if (!food?.restaurant) throw new NotFoundException(`Food with ID ${foodId} not found`);

    const toppingsById = new Map((food.toppings ?? []).map((topping) => [topping.id, topping]));
    const toppings: OrderableToppingSnapshot[] = toppingIds.map((toppingId) => {
      const topping = toppingsById.get(toppingId);
      if (!topping) {
        throw new BadRequestException(`Topping ${toppingId} is not attached to food ${foodId}`);
      }
      return Object.freeze({
        toppingId: topping.id,
        name: topping.name,
        unitPrice: Number(topping.price),
        isAvailable: topping.isAvailable === true,
      });
    });

    const status = food.status ?? null;
    return Object.freeze({
      foodId: food.id,
      restaurantId: food.restaurant.id,
      name: food.name ?? '',
      unitPrice: Number(food.price),
      status,
      isAvailable: status === 'available' && toppings.every((topping) => topping.isAvailable),
      toppings: Object.freeze(toppings),
    });
  }
}
