import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingAssignmentStore } from 'src/infra/queue/pending-assignment-store.service';
import { QueueModule } from 'src/infra/queue/queue.module';
import { QueueService } from 'src/infra/queue/queue.service';

describe('Queue adapter boundary', () => {
  it('contains only technical queue providers and no domain repositories', () => {
    const imports = Reflect.getMetadata('imports', QueueModule) as unknown[];
    const providers = Reflect.getMetadata('providers', QueueModule) as unknown[];

    expect(imports.some((item) => isTypeOrmImport(item))).toBe(false);
    expect(providers).toEqual(expect.arrayContaining([QueueService, PendingAssignmentStore]));
    expect(providers).not.toContain(expect.objectContaining({ name: 'PendingAssignmentService' }));
  });
});

function isTypeOrmImport(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'module' in value &&
    value.module === TypeOrmModule
  );
}
