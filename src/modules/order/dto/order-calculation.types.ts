import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { User } from 'src/entities/user.entity';

export interface SelectedOrderTopping {
  id: string;
  name?: string;
  price: number;
}

export interface OrderCalculationItem {
  foodId: string;
  quantity: number;
  discountPercent?: number;
  toppings?: SelectedOrderTopping[];
}

export interface ValidatedOrderDetail {
  food: Food;
  quantity: number;
  selectedToppings: { id: string; name: string; price: number }[];
  toppingTotal: number;
  discountPercent: number;
  discountedPrice: number;
  itemTotal: number;
}

export interface ValidatedOrderDetailsResult {
  calculatedTotal: number;
  foodDetails: ValidatedOrderDetail[];
}

export interface ValidatedOrderContext {
  user: User;
  restaurant: Restaurant;
  address: Address;
}

export interface DeliveryRouteResult {
  distance: number;
  estimatedDeliveryTime: number;
}

export interface OrderCalculationResult {
  foodTotal: number;
  shippingFee: number;
  shipperEarnings?: number;
  shipperCommissionRate?: number;
  platformFee?: number;
  distance: number;
  subtotal: number;
  promotionDiscount: number;
  total: number;
  estimatedDeliveryTime: number;
  appliedPromotion: Promotion | null;
  promotionError: string | null;
}

export interface CustomAddressCalculationResult {
  foodTotal: number;
  shippingFee: number;
  distance: number;
  estimatedDeliveryTime: number;
  subtotal: number;
  promotionDiscount: number;
  total: number;
  appliedPromotion: {
    id: string;
    code: string;
    description: string;
    type: string;
    discountAmount: number;
  } | null;
  promotionError: string | null;
}
