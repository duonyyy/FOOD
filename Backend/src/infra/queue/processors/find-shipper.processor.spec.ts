import { Job, UnrecoverableError } from 'bullmq';
import { FindShipperProcessor } from './find-shipper.processor';

describe('FindShipperProcessor', () => {
  const validJob = {
    id: 'job-1',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: { pendingAssignmentId: 'assignment-1', orderId: 'order-1', attempt: 1 },
  } as Job<any>;

  it('only forwards a valid job to the Delivery application service', async () => {
    const scheduler = { processShipperAssignmentJobData: jest.fn().mockResolvedValue(undefined) };
    const processor = new FindShipperProcessor(scheduler as never);

    await processor.process(validJob);

    expect(scheduler.processShipperAssignmentJobData).toHaveBeenCalledWith('job-1', validJob.data);
  });

  it('routes malformed payloads to dead-letter without calling business logic', async () => {
    const scheduler = { processShipperAssignmentJobData: jest.fn() };
    const processor = new FindShipperProcessor(scheduler as never);
    const job = { ...validJob, data: { orderId: 'order-1' } } as Job<any>;

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(scheduler.processShipperAssignmentJobData).not.toHaveBeenCalled();
  });

  it('logs a dead-letter event after the final retry and rethrows retryable errors', async () => {
    const scheduler = {
      processShipperAssignmentJobData: jest
        .fn()
        .mockRejectedValue(new Error('temporary Redis failure')),
    };
    const processor = new FindShipperProcessor(scheduler as never);
    const logger = (processor as any).logger;
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const job = { ...validJob, attemptsMade: 2 } as Job<any>;

    await expect(processor.process(job)).rejects.toThrow('temporary Redis failure');
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'queue_dead_letter',
        retryable: true,
        jobId: 'job-1',
      }),
      expect.any(String),
    );
    loggerSpy.mockRestore();
  });
});
