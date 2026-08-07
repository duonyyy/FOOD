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
  foodId: string;
  restaurantId: string;
  name: string;
  unitPrice: number;
  isAvailable: boolean;
  toppings: OrderableToppingSnapshot[];
}

export interface OrderableToppingSnapshot {
  toppingId: string;
  name: string;
  unitPrice: number;
  isAvailable: boolean;
}
