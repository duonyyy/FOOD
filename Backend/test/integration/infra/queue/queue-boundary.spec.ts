import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueueModule } from 'src/infra/queue/queue.module';
import { QueueService } from 'src/infra/queue/queue.service';

describe('Queue adapter boundary', () => {
  it('contains only technical queue providers and no domain repositories', () => {
    const registration = QueueModule.register({ name: 'technical-jobs' });
    const imports = registration.imports ?? [];
    const providers = registration.providers ?? [];

    expect(imports.some((item) => isTypeOrmImport(item))).toBe(false);
    expect(providers).toEqual(expect.arrayContaining([QueueService]));
    expect(providers).not.toContain(expect.objectContaining({ name: 'PendingAssignmentService' }));
    expect(providers).not.toContain(expect.objectContaining({ name: 'PendingAssignmentStore' }));
    expect(imports).not.toContain(expect.objectContaining({ name: 'StorageModule' }));
  });

  it('does not make the queue adapter depend on a business feature or delivery vocabulary', () => {
    const queueService = readFileSync(
      resolve(process.cwd(), 'src/infra/queue/queue.service.ts'),
      'utf8',
    );
    const queueModule = readFileSync(
      resolve(process.cwd(), 'src/infra/queue/queue.module.ts'),
      'utf8',
    );
    const queueTypes = readFileSync(
      resolve(process.cwd(), 'src/infra/queue/queue.types.ts'),
      'utf8',
    );
    const queueSource = [queueService, queueModule, queueTypes].join('\n');

    expect(queueSource).not.toContain('src/features/');
    expect(queueSource).not.toMatch(/shipper|orderId|pendingAssignment/i);
    expect(queueService).toContain("from './queue.types'");
    expect(queueModule).toContain('static register');
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
