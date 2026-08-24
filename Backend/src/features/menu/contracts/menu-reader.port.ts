export const MENU_READER = Symbol('MENU_READER');

export interface MenuReaderPort {
  getOrderableItems(request: GetOrderableItemsRequest): Promise<OrderableItemSnapshot[]>;
}

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
