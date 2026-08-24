import { CreateOutboxEvents1760000000005 } from './1760000000005-CreateOutboxEvents';

describe('outbox event migration', () => {
  it('creates idempotent dispatch storage with retry fields', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((query: string) => queries.push(query)) };

    await new CreateOutboxEvents1760000000005().up(queryRunner as never);

    const source = queries.join('\n');
    expect(source).toContain('outbox_events');
    expect(source).toContain('UQ_outbox_events_idempotency_key');
    expect(source).toContain('IDX_outbox_events_dispatch');
    expect(source).toContain('last_error');
  });
});
