export interface OrderPricingToppingSnapshot {
  readonly id: string;
  readonly unitPrice: number;
}

export interface OrderPricingItemSnapshot {
  readonly foodId: string;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly quantity: number;
  readonly toppings: readonly OrderPricingToppingSnapshot[];
}

export interface OrderPricingInput {
  readonly items: readonly OrderPricingItemSnapshot[];
  readonly shippingFee: number;
  readonly promotionDiscount: number;
}

export interface OrderPricingResult {
  readonly foodTotal: number;
  readonly shippingFee: number;
  readonly subtotal: number;
  readonly promotionDiscount: number;
  readonly total: number;
}

/** Pure money calculation. It must not depend on repositories, providers, or request totals. */
export class OrderPricingService {
  calculate(input: OrderPricingInput): OrderPricingResult {
    const foodTotal = input.items.reduce((total, item) => {
      const discountPercent = Math.min(100, Math.max(0, item.discountPercent));
      const discountedUnitPrice = item.unitPrice - (item.unitPrice * discountPercent) / 100;
      const toppingsTotal = item.toppings.reduce((sum, topping) => sum + topping.unitPrice, 0);

      return total + Math.round((discountedUnitPrice + toppingsTotal) * item.quantity);
    }, 0);

    const shippingFee = Math.max(0, Math.round(input.shippingFee));
    const subtotal = foodTotal + shippingFee;
    const promotionDiscount = Math.min(subtotal, Math.max(0, Math.round(input.promotionDiscount)));

    return {
      foodTotal,
      shippingFee,
      subtotal,
      promotionDiscount,
      total: Math.max(0, subtotal - promotionDiscount),
    };
  }
}
