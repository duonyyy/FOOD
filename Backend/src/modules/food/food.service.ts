/**
 * Compatibility facade for legacy Chat callers.
 * Catalog owns the implementation; callers can migrate without changing
 * behaviour while the legacy module path remains public.
 */
export {
  FoodQueryService,
  FoodQueryService as FoodService,
} from '../../features/menu/foods/food-query.service';
