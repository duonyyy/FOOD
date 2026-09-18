import { QueueService } from 'src/infra/queue/queue.service';

describe('QueueService', () => {
  const queueName = 'technical-jobs';
  const queue = {
    add: jest.fn(),
    getJobCounts: jest.fn(),
  };
  let service: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueueService(queue as never, queueName);
  });

  it('preserves retry, backoff and cleanup options at the technical boundary', async () => {
    queue.add.mockResolvedValue({ id: 'job-1' });

    await expect(
      service.addJob(
        queueName,
        { resourceId: 'resource-1', attempt: 1 },
        {
          attempts: 5,
          backoffDelayMs: 900,
          delayMs: 50,
          priority: 2,
          jobId: 'technical-jobs:resource-1:1',
          removeOnComplete: false,
          removeOnFail: 20,
        },
      ),
    ).resolves.toBe('job-1');

    expect(queue.add).toHaveBeenCalledWith(
      queueName,
      { resourceId: 'resource-1', attempt: 1 },
      {
        attempts: 5,
        backoff: { type: 'fixed', delay: 900 },
        delay: 50,
        priority: 2,
        jobId: 'technical-jobs:resource-1:1',
        removeOnComplete: false,
        removeOnFail: 20,
      },
    );
  });

  it('reports an unhealthy queue instead of pretending that Redis is available', async () => {
    queue.getJobCounts.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.getHealthStatus()).resolves.toEqual({ isHealthy: false });
  });
});
