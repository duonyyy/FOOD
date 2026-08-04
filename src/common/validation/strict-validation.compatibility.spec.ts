import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderRequestDto } from 'src/modules/order/dto/create-order-request.dto';
import { RequestRestaurantDto } from 'src/modules/restaurant/dto/restaurant-request.dto';
import { UpdateMeDto } from 'src/modules/users/dto/update-me.dto';
import { PaymentWebhookDto } from 'src/payment/dto/payment-request.dto';

describe('Strict validation compatibility', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  });

  async function validate<T>(value: unknown, metatype: new () => T): Promise<T> {
    return pipe.transform(value, {
      type: 'body',
      metatype,
    } as ArgumentMetadata) as Promise<T>;
  }

  async function expectRejectedField(promise: Promise<unknown>, field: string): Promise<void> {
    try {
      await promise;
      throw new Error(`Expected ${field} to be rejected`);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { message: string[] };
      expect(response.message.join(' ')).toContain(`${field} should not exist`);
    }
  }

  it('accepts legacy order price/total fields but transforms values for server-side pricing', async () => {
    const result = await validate(
      {
        restaurantId: '11111111-1111-4111-8111-111111111111',
        addressId: '22222222-2222-4222-8222-222222222222',
        total: '1000',
        orderDetails: [
          {
            foodId: '33333333-3333-4333-8333-333333333333',
            quantity: 2,
            price: 1,
          },
        ],
      },
      CreateOrderRequestDto,
    );

    expect(result.total).toBe(1000);
    expect(result.orderDetails[0]).toMatchObject({ quantity: '2', price: '1' });
  });

  it('rejects actor identity supplied by an order client', async () => {
    await expectRejectedField(
      validate(
        {
          userId: 'attacker-controlled',
          restaurantId: '11111111-1111-4111-8111-111111111111',
          addressId: '22222222-2222-4222-8222-222222222222',
          orderDetails: [
            {
              foodId: '33333333-3333-4333-8333-333333333333',
              quantity: 1,
            },
          ],
        },
        CreateOrderRequestDto,
      ),
      'userId',
    );
  });

  it('keeps the legacy update-me address alias but rejects role escalation fields', async () => {
    const accepted = await validate({ address: [{ street: '1 Main', city: 'HCM' }] }, UpdateMeDto);
    expect(accepted.address).toHaveLength(1);

    await expectRejectedField(validate({ role: 'administrator' }, UpdateMeDto), 'role');
    await expectRejectedField(
      validate(
        { addresses: [{ street: '1 Main', city: 'HCM', userId: 'attacker-controlled' }] },
        UpdateMeDto,
      ),
      'userId',
    );
  });

  it('rejects owner/status injection during restaurant onboarding', async () => {
    await expectRejectedField(
      validate(
        {
          name: 'Safe restaurant',
          ownerId: 'attacker-controlled',
          status: 'approved',
        },
        RequestRestaurantDto,
      ),
      'ownerId',
    );
  });

  it('accepts the normalized payment callback and rejects unknown fields', async () => {
    const payload = {
      partnerCode: 'MOMO',
      orderId: 'provider-reference',
      requestId: 'request-1',
      amount: '100000',
      resultCode: '0',
    };
    const accepted = await validate(payload, PaymentWebhookDto);
    expect(accepted.amount).toBe(100000);

    await expectRejectedField(
      validate({ ...payload, internalStatus: 'completed' }, PaymentWebhookDto),
      'internalStatus',
    );
  });
});
