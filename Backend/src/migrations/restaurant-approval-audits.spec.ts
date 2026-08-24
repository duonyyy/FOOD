import { CreateRestaurantApprovalAudits1760000000001 } from './1760000000001-CreateRestaurantApprovalAudits';

describe('restaurant approval audit migration', () => {
  it('creates durable, constrained approval audit records', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new CreateRestaurantApprovalAudits1760000000001().up(queryRunner as never);

    const source = queries.join('\n');
    expect(source).toContain('restaurant_approval_audits');
    expect(source).toContain('CHK_restaurant_approval_audits_transition');
    expect(source).toContain('IDX_restaurant_approval_audits_restaurant_id');
  });
});
