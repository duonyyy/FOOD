export interface OrderItemToppingSnapshot {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface OrderItemSnapshot {
  readonly foodId: string;
  readonly foodName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly toppings: readonly OrderItemToppingSnapshot[];
}

export function createOrderItemSnapshot(input: OrderItemSnapshot): OrderItemSnapshot {
  return Object.freeze({
    foodId: input.foodId,
    foodName: input.foodName,
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    toppings: Object.freeze(input.toppings.map((topping) => Object.freeze({ ...topping }))),
  });
}
