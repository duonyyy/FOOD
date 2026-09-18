export interface GetOrderableItemsRequest {
  items: RequestedMenuItem[];
}

export interface RequestedMenuItem {
  foodId: string;
  toppingIds: string[];
}

export interface OrderableMenuItem {
  readonly foodId: string;
  readonly restaurantId: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly status: string | null;
  readonly isAvailable: boolean;
  readonly toppings: readonly OrderableTopping[];
}

export interface OrderableTopping {
  readonly toppingId: string;
  readonly name: string;
  readonly unitPrice: number;
  readonly isAvailable: boolean;
}
