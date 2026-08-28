import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingAssignmentStore } from './pending-assignment-store.service';
import { QueueModule } from './queue.module';
import { QueueService } from './queue.service';

describe('Queue adapter boundary', () => {
  it('contains only technical queue providers and no domain repositories', () => {
    const imports = Reflect.getMetadata('imports', QueueModule) as unknown[];
    const providers = Reflect.getMetadata('providers', QueueModule) as unknown[];

    expect(imports.some((item: any) => item?.module === TypeOrmModule)).toBe(false);
    expect(providers).toEqual(expect.arrayContaining([QueueService, PendingAssignmentStore]));
    expect(providers).not.toContain(expect.objectContaining({ name: 'PendingAssignmentService' }));
  });
});
