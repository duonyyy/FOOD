export interface GetOrderableItemsRequest {
  items: RequestedMenuItem[];
}

export interface RequestedMenuItem {
  foodId: string;
  toppingIds: string[];
}

export interface OrderableItemSnapshot {
  readonly foodId: string;
  readonly restaurantId: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly status: string | null;
  readonly isAvailable: boolean;
  readonly toppings: readonly OrderableToppingSnapshot[];
}

export interface OrderableToppingSnapshot {
  readonly toppingId: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly isAvailable: boolean;
}
