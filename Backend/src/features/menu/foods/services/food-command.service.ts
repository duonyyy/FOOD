import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantFoodService } from './merchant-food.service';

/**
 * Backward compatibility facade for FoodCommandService.
 * Core merchant operations live in MerchantFoodService.
 */
@Injectable()
export class FoodCommandService extends MerchantFoodService {
  /** Admin-only compatibility command; permission is enforced by the controller guard. */
  async delete(id: string): Promise<void> {
    const food = await this.foodRepository.findOne({
      where: { id },
      relations: ['restaurant', 'category'],
    });
    if (!food) throw new NotFoundException(`Food with ID ${id} not found`);
    await this.foodRepository.remove(food);
    await Promise.all(
      [food.image, ...(food.imageUrls || [])]
        .filter((url): url is string => Boolean(url))
        .map((url) => this.storage.deleteFile(url)),
    );
    await this.invalidateMenuCache(id, food.restaurant?.id, food.category?.id);
  }
}
