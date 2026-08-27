import { AddPaymentReconciliationState1761000000002 } from './1761000000002-AddPaymentReconciliationState';

describe('payment reconciliation migration', () => {
  it('adds durable bounded-retry state to checkouts', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new AddPaymentReconciliationState1761000000002().up(queryRunner as never);

    const source = queries.join('\n');
    expect(source).toContain('reconciliation_attempts');
    expect(source).toContain('reconciliation_last_attempt_at');
    expect(source).toContain('reconciliation_last_error');
  });
});
