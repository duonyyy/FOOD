import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';

describe('OrderDeliveryService shipper data', () => {
  it('returns a plain read model, not a mutable Order entity', async () => {
    const order = {
      id: 'order-1',
      status: 'shipper_received',
      total: 120000,
      note: null,
      user: { id: 'user-1', name: 'Customer' },
      restaurant: { id: 'restaurant-1', name: 'Store' },
      address: { street: '1 Main', ward: 'Ward', district: 'District', city: 'City' },
      orderDetails: [
        { id: 'detail-1', quantity: 2, price: '60000', food: { id: 'food-1', name: 'Food' } },
      ],
    };
    const repository = { findOne: jest.fn().mockResolvedValue(order) };
    const service = new OrderDeliveryService(repository as never, {} as never, {} as never);

    await expect(service.getShipperOrder('order-1')).resolves.toEqual({
      id: 'order-1',
      status: 'shipper_received',
      total: 120000,
      note: null,
      user: { id: 'user-1', name: 'Customer' },
      restaurant: { id: 'restaurant-1', name: 'Store' },
      address: { street: '1 Main', ward: 'Ward', district: 'District', city: 'City' },
      orderDetails: [
        { id: 'detail-1', quantity: 2, price: '60000', food: { id: 'food-1', name: 'Food' } },
      ],
    });
  });
});
