# Phân tích BullMQ trong dự án Foodee Backend

Tài liệu này giải thích cách dự án đang dùng BullMQ theo hướng dễ tiếp cận cho người mới. Mục tiêu là giúp bạn hiểu:

- BullMQ là gì và vì sao cần queue.
- Dự án setup BullMQ ở đâu.
- Queue nào đang được dùng.
- Flow producer -> queue -> worker -> job processing chạy như thế nào.
- Retry, delay, priority, concurrency, failed jobs và monitoring đang được xử lý ra sao.
- Setup hiện tại đã production-ready chưa và nên cải thiện gì.

## 1. BullMQ là gì?

BullMQ là thư viện queue cho Node.js, dùng Redis để lưu và điều phối các job chạy nền. Thay vì xử lý mọi việc ngay trong request HTTP, ứng dụng có thể đưa công việc vào hàng đợi, sau đó worker xử lý sau.

Ví dụ trong dự án Foodee:

1. Nhà hàng xác nhận đơn hàng.
2. Hệ thống cần tìm shipper gần nhất.
3. Việc tìm shipper có thể mất thời gian, cần retry, cần tránh trùng lặp.
4. Thay vì làm tất cả trong request xác nhận đơn, dự án tạo một pending assignment và đưa job vào BullMQ.
5. Worker lấy job ra xử lý và gửi thông báo cho shipper.

Một số khái niệm chính:

- Producer: nơi tạo job và đẩy vào queue.
- Queue: hàng đợi lưu job trong Redis.
- Worker/Processor: nơi lấy job từ queue và xử lý.
- Job: một đơn vị công việc, gồm tên, data và options.
- Redis: nơi BullMQ lưu trạng thái queue/job.

## 2. Kiến trúc BullMQ tổng thể trong dự án

Phần BullMQ chính nằm trong thư mục:

```text
src/queue
```

Các file quan trọng:

```text
src/queue/queue.module.ts
src/queue/queue.service.ts
src/queue/queue.constants.ts
src/queue/processors/find-shipper.processor.ts
src/queue/pending-assignment.service.ts
```

Lưu ý quan trọng: file `src/queue/pending-assignment.service.ts` hiện chỉ re-export service từ:

```text
src/pg-boss/pending-assignment.service.ts
```

Nghĩa là logic nghiệp vụ gán shipper vẫn nằm trong folder có tên `pg-boss`, nhưng queue runtime hiện tại đang dùng BullMQ. Đây là dấu vết của việc migrate từ pg-boss sang BullMQ.

## 3. Redis connection

Redis được cấu hình trong `src/queue/queue.module.ts`:

```ts
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null,
    },
  }),
})
```

Ý nghĩa:

- `REDIS_HOST`: host Redis, mặc định `localhost`.
- `REDIS_PORT`: port Redis, mặc định `6379`.
- `REDIS_PASSWORD`: password nếu Redis có đặt mật khẩu.
- `REDIS_DB`: database index của Redis, mặc định `0`.
- `maxRetriesPerRequest: null`: cấu hình phù hợp với BullMQ/ioredis để worker có thể hoạt động ổn định với blocking commands.

Trong `docker-compose.yml`, Redis được khai báo:

```yaml
redis:
  image: redis:7-alpine
  container_name: foodee_redis
  restart: unless-stopped
  command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"]
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

Ý nghĩa:

- `appendonly yes`: bật AOF persistence, Redis ghi log để khôi phục dữ liệu sau restart.
- `maxmemory 256mb`: giới hạn bộ nhớ Redis.
- `noeviction`: khi đầy bộ nhớ, Redis không tự xóa key mà sẽ báo lỗi ghi mới.

## 4. Queue được register

Queue names nằm trong `src/queue/queue.constants.ts`:

```ts
export const QueueNames = {
  FIND_SHIPPER: 'find-shipper',
  NOTIFY_SHIPPERS: 'notify-shippers',
} as const;
```

Hiện tại chỉ có queue `find-shipper` được register thật sự trong `queue.module.ts`:

```ts
BullModule.registerQueue({
  name: QueueNames.FIND_SHIPPER,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
})
```

Ý nghĩa:

- Queue tên `find-shipper`.
- Mỗi job mặc định retry tối đa 3 lần.
- Mỗi lần retry cách nhau 5000ms.
- Job thành công sẽ bị xóa khỏi Redis.
- Job failed được giữ tối đa 1000 job.

`NOTIFY_SHIPPERS` mới chỉ được khai báo hằng số, chưa được register và chưa có processor.

## 5. QueueService: lớp wrapper quanh BullMQ

File:

```text
src/queue/queue.service.ts
```

Service này đóng vai trò là lớp trung gian để các feature khác không cần gọi trực tiếp BullMQ API.

### 5.1 Inject queue

```ts
constructor(
  @InjectQueue(QueueNames.FIND_SHIPPER)
  private readonly findShipperQueue: Queue,
) {
  this.logger.log('QueueService initialized with BullMQ');
}
```

Ý nghĩa:

- NestJS inject queue `find-shipper` vào service.
- `findShipperQueue` là object BullMQ `Queue`.
- Các method bên dưới sẽ dùng object này để add job, get stats, cancel job.

### 5.2 Add job

```ts
async addJob<T extends object>(
  queueName: string,
  jobData: T,
  options?: QueueJobOptions,
): Promise<string> {
  const queue = this.getQueue(queueName);
  const job = await queue.add(queueName, jobData, this.toBullJobOptions(options));
  return String(job.id);
}
```

Ý nghĩa:

- Nhận `queueName`, `jobData`, `options`.
- Lấy queue từ `getQueue`.
- Gọi `queue.add(...)` để tạo job trong Redis.
- Trả về `job.id`.

Trong dự án, job name đang được đặt bằng chính tên queue:

```ts
queue.add(queueName, jobData, options)
```

Ví dụ job của queue `find-shipper` cũng có name là `find-shipper`.

### 5.3 Job options

```ts
private toBullJobOptions(options?: QueueJobOptions): JobsOptions {
  return {
    attempts: options?.attempts ?? 3,
    backoff: {
      type: 'fixed',
      delay: options?.backoffDelayMs ?? 5000,
    },
    delay: options?.delayMs,
    priority: options?.priority,
    jobId: options?.jobId,
    removeOnComplete: options?.removeOnComplete ?? true,
    removeOnFail: options?.removeOnFail ?? 1000,
  };
}
```

Ý nghĩa:

- `attempts`: số lần BullMQ retry nếu job throw error.
- `backoff`: khoảng cách giữa các lần retry.
- `delay`: trì hoãn job trước khi worker có thể xử lý.
- `priority`: độ ưu tiên của job.
- `jobId`: id tùy chỉnh, giúp tránh duplicate job.
- `removeOnComplete`: xóa job sau khi thành công.
- `removeOnFail`: giữ failed jobs theo số lượng hoặc xóa tùy cấu hình.

### 5.4 Queue stats và health

QueueService có các method:

```ts
getQueueSize(queueName)
getPendingJobs(queueName, limit)
getQueueStats(queueName)
cancelJob(queueName, jobId)
archiveCompletedJobs(queueName)
purgeArchivedJobs(queueName)
getHealthStatus()
```

Ý nghĩa:

- `getQueueSize`: đếm job đang `waiting`, `delayed`, `prioritized`.
- `getPendingJobs`: lấy danh sách job đang chờ.
- `getQueueStats`: trả về size và 5 pending jobs đầu tiên.
- `cancelJob`: xóa job theo id.
- `archiveCompletedJobs`: clean completed jobs cũ hơn 24h.
- `purgeArchivedJobs`: clean failed jobs cũ hơn 7 ngày.
- `getHealthStatus`: gọi `getJobCounts` để kiểm tra queue có hoạt động không.

Hiện tại các method này chưa thấy được expose thành admin API riêng.

## 6. Processor/Worker

File:

```text
src/queue/processors/find-shipper.processor.ts
```

Code:

```ts
@Processor(QueueNames.FIND_SHIPPER, {
  concurrency: 1,
})
export class FindShipperProcessor extends WorkerHost {
  async process(job: Job<FindShipperJobData>): Promise<void> {
    try {
      await this.pendingAssignmentService.processShipperAssignmentJobData(String(job.id), job.data);
    } catch (error) {
      this.logger.error(`Failed to process find-shipper job ${job.id}: ${message}`, stack);
      throw error;
    }
  }
}
```

Ý nghĩa:

- `@Processor(QueueNames.FIND_SHIPPER)`: class này là worker của queue `find-shipper`.
- `concurrency: 1`: mỗi process chỉ xử lý 1 job cùng lúc.
- `process(job)`: hàm chạy mỗi khi có job.
- Nếu xử lý lỗi, worker throw lại error để BullMQ đánh dấu job failed và retry theo cấu hình.

Worker không chứa nhiều business logic. Nó chỉ forward job sang `PendingAssignmentService`.

## 7. Feature dùng BullMQ: tự động tìm shipper

Feature chính của BullMQ trong dự án là:

```text
Tự động tìm và thông báo shipper gần nhất cho đơn hàng đã confirmed.
```

Business logic nằm trong:

```text
src/pg-boss/pending-assignment.service.ts
```

Mặc dù folder là `pg-boss`, class này hiện đang được BullMQ processor gọi vào.

## 8. Flow chi tiết: producer -> queue -> worker -> job processing

### Bước 1: Order được confirmed

Trong `src/modules/order/order.service.ts`, method `confirmOrder`:

```ts
order.status = 'confirmed';
const confirmedOrder = await this.orderRepository.save(order);

const pendingAssignment = await this.pendingAssignmentService.addPendingAssignment(
  confirmedOrder.id,
  1
);
```

Ý nghĩa:

- Khi nhà hàng xác nhận order, status chuyển sang `confirmed`.
- Hệ thống tạo một pending assignment cho order này.
- Priority mặc định là `1`.

Ngoài ra trong `src/modules/order/order.controller.ts`, nếu restaurant update status sang `confirmed`, controller cũng gọi:

```ts
await this.pendingAssignmentService.addPendingAssignment(id, 1);
```

### Bước 2: Lưu pending assignment vào DB

Entity:

```text
src/entities/pendingShipperAssignment.entity.ts
```

Các field quan trọng:

```ts
priority: number;
attemptCount: number;
lastAttemptAt: Date;
nextAttemptAt: Date;
createdAt: Date;
isSentToShipper: boolean;
```

Ý nghĩa:

- `priority`: độ ưu tiên của assignment.
- `attemptCount`: đã thử tìm shipper bao nhiêu lần.
- `nextAttemptAt`: lúc nào được thử tiếp.
- `isSentToShipper`: đã gửi lời mời cho shipper và đang chờ phản hồi hay chưa.

Method tạo record:

```ts
private async createPendingAssignment(order: Order, priority: number): Promise<PendingShipperAssignment> {
  const pendingAssignment = this.pendingAssignmentRepository.create({
    order,
    priority,
    attemptCount: 0,
    nextAttemptAt: new Date(),
    isSentToShipper: false,
  });

  return this.pendingAssignmentRepository.save(pendingAssignment);
}
```

Ý nghĩa:

- Assignment mới sẽ được xử lý ngay vì `nextAttemptAt = now`.
- Ban đầu chưa gửi cho shipper nào.

### Bước 3: Cron quét pending assignments

Trong `PendingAssignmentService`:

```ts
@Cron(CronExpression.EVERY_5_SECONDS)
async checkPendingAssignmentsAndCreateJobs(): Promise<void> {
  const pendingAssignments = await this.pendingAssignmentRepository.find({
    where: {
      nextAttemptAt: LessThan(new Date())
    },
    relations: ['order', 'order.restaurant', 'order.user', 'order.address', 'order.shippingDetail'],
    order: {
      priority: 'DESC',
      createdAt: 'ASC'
    },
    take: 50
  });
}
```

Ý nghĩa:

- Cứ 5 giây, service vào DB lấy các assignment đã đến lúc xử lý.
- Lấy tối đa 50 record mỗi lần.
- Ưu tiên assignment có `priority` cao hơn.
- Nếu cùng priority, order cũ hơn được xử lý trước.

### Bước 4: Validate assignment trước khi enqueue

```ts
private async validatePendingAssignment(assignment: PendingShipperAssignment): Promise<boolean> {
  const order = assignment.order;

  if (!order || order.status !== 'confirmed') {
    return false;
  }

  if (order.shippingDetail) {
    return false;
  }

  if (assignment.isSentToShipper == true) {
    return false;
  }

  const maxAttempts = 15;
  const maxAgeMinutes = 30;

  if (assignment.attemptCount >= maxAttempts || isExpired) {
    return false;
  }

  return true;
}
```

Ý nghĩa:

- Chỉ tìm shipper cho order còn `confirmed`.
- Nếu order đã có shipper thì bỏ qua.
- Nếu đã gửi cho một shipper và đang đợi phản hồi thì bỏ qua.
- Nếu quá số lần thử hoặc quá tuổi đời thì không xử lý nữa.

### Bước 5: Producer tạo job BullMQ

```ts
private async createJobForPendingAssignment(assignment: PendingShipperAssignment): Promise<string | null> {
  const jobData: FindShipperJobData = {
    pendingAssignmentId: assignment.id,
    orderId: assignment.order.id,
    attempt: assignment.attemptCount + 1
  };

  const jobOptions = {
    attempts: 3,
    backoffDelayMs: 5000,
    priority: assignment.priority,
    jobId: `find-shipper:${assignment.id}:${assignment.attemptCount + 1}`,
    removeOnComplete: true,
    removeOnFail: 1000,
  };

  const jobId = await this.queueService.addJob(
    QueueNames.FIND_SHIPPER,
    jobData,
    jobOptions
  );

  return jobId;
}
```

Ý nghĩa:

- Job data chỉ nên gồm dữ liệu cần thiết: assignment id, order id, attempt.
- Worker sẽ reload dữ liệu mới nhất từ DB khi xử lý.
- `jobId` có dạng deterministic để giảm duplicate.
- Job có retry kỹ thuật 3 lần nếu worker throw error.

### Bước 6: BullMQ lưu job vào Redis

Khi `queue.add(...)` được gọi:

- BullMQ ghi job vào Redis.
- Job vào trạng thái waiting/prioritized/delayed tùy options.
- Worker đang lắng nghe queue `find-shipper` sẽ lấy job ra xử lý.

### Bước 7: Worker nhận job

```ts
async process(job: Job<FindShipperJobData>): Promise<void> {
  await this.pendingAssignmentService.processShipperAssignmentJobData(String(job.id), job.data);
}
```

Ý nghĩa:

- Worker không xử lý trực tiếp.
- Worker gọi service nghiệp vụ để xử lý.
- Nếu service throw error, BullMQ sẽ retry/fail job.

### Bước 8: Xử lý job tìm shipper

Trong `processShipperAssignmentJobData`:

```ts
const assignment = await this.pendingAssignmentRepository.findOne({
  where: { id: pendingAssignmentId },
  relations: ['order', 'order.restaurant', 'order.user', 'order.address', 'order.orderDetails', 'order.orderDetails.food']
});
```

Ý nghĩa:

- Worker reload assignment và order từ DB.
- Cách này tốt hơn việc đưa cả object order vào job data, vì dữ liệu trong DB có thể đã thay đổi.

Sau đó validate:

```ts
if (order.status !== 'confirmed') {
  await this.pendingAssignmentRepository.remove(assignment);
  this.shipperTracker.clearOrder(orderId);
  return;
}
```

Nếu order không còn confirmed, assignment bị xóa.

Check đã có shipper:

```ts
const currentOrder = await this.orderRepository.findOne({
  where: { id: orderId },
  relations: ['shippingDetail']
});

if (currentOrder?.shippingDetail) {
  await this.pendingAssignmentRepository.remove(assignment);
  this.shipperTracker.clearOrder(orderId);
  return;
}
```

Nếu order đã có shipping detail, không cần tìm shipper nữa.

### Bước 9: Tìm shipper gần nhất

```ts
const nearestShipper = await this.findNearestAvailableShipper(order);
```

`findNearestAvailableShipper` lấy danh sách shipper đang active từ:

```ts
activeShipperTracker.getAllShippers()
```

Sau đó:

- Bỏ qua shipper đã được notify cho order này.
- Tính khoảng cách bằng `haversineDistance`.
- Chọn shipper gần nhà hàng nhất và nằm trong `maxDistance`.

Nếu không tìm thấy shipper:

```ts
await this.scheduleRetryForAssignment(assignment);
return;
```

### Bước 10: Publish thông báo cho shipper

Nếu tìm được shipper:

```ts
await pubSub.publish('orderConfirmedForShippers', {
  orderConfirmedForShippers: {
    ...order,
    shipperEarnings,
    shippingFee
  },
  targetShipperId: nearestShipper.shipperId,
  distanceKm: distance,
  priorityScore: assignment.priority,
  earningsInfo: {
    shippingFee,
    shipperEarnings,
    platformFee: shippingFee - shipperEarnings,
    netProfit: Math.max(0, shipperEarnings - (distance * 3000)),
    earningsPerKm: distance > 0 ? Math.round(shipperEarnings / distance) : 0
  }
});
```

Ý nghĩa:

- Worker gửi event qua GraphQL PubSub.
- Client shipper có thể subscribe event và nhận đơn.
- Payload kèm thông tin tiền ship, lợi nhuận, khoảng cách.

Sau khi publish thành công:

```ts
assignment.isSentToShipper = true;
await this.pendingAssignmentRepository.save(assignment);
this.shipperTracker.addNotifiedShipper(orderId, nearestShipper.shipperId);
```

Ý nghĩa:

- Đánh dấu order đang được gửi cho shipper.
- Tránh cron tiếp tục tạo job mới cho assignment này trong lúc đợi shipper trả lời.
- Ghi nhớ shipper đã được hỏi để lần sau không hỏi lại cùng người.

### Bước 11: Timeout nếu shipper không phản hồi

```ts
this.shipperTracker.setResponseTimeout(orderId, async () => {
  latestAssignment.isSentToShipper = false;
  await this.pendingAssignmentRepository.save(latestAssignment);
  await this.scheduleRetryForAssignment(latestAssignment);
}, 2 * 60 * 1000);
```

Ý nghĩa:

- Shipper có 2 phút để phản hồi.
- Nếu hết 2 phút mà không có kết quả, reset `isSentToShipper = false`.
- Sau đó schedule retry để tìm shipper khác.

### Bước 12: Khi shipper chấp nhận

Trong `src/modules/shipper/shipper.service.ts`, method `assignOrderToShipper`:

```ts
const shippingDetail = new ShippingDetail();
shippingDetail.order = order;
shippingDetail.shipper = shipper;
shippingDetail.status = ShippingStatus.SHIPPING;

await this.shippingDetailRepository.save(shippingDetail);

order.status = 'shipper_received';
await this.orderRepository.save(order);

await this.pendingShipperAssignmentRepository.delete({
  order: { id: orderId },
});
```

Ý nghĩa:

- Tạo shipping detail gắn order với shipper.
- Đổi status order sang `shipper_received`.
- Xóa pending assignment vì order đã có shipper.

### Bước 13: Khi shipper từ chối

Trong `rejectOrder`:

```ts
await this.pendingShipperAssignmentRepository.update(
  { order: { id: orderId } },
  { isSentToShipper: false }
);
```

Ý nghĩa:

- Mở khóa assignment.
- Cron có thể lấy assignment này lên và tạo job tìm shipper khác.

## 9. Retry trong dự án

Dự án hiện có 2 lớp retry.

### 9.1 Retry kỹ thuật của BullMQ

Cấu hình:

```ts
attempts: 3,
backoff: {
  type: 'fixed',
  delay: 5000,
}
```

Nếu worker throw error:

1. BullMQ đánh dấu job failed tạm thời.
2. Chờ 5 giây.
3. Chạy lại job.
4. Sau 3 lần vẫn lỗi thì job failed thật sự.

Retry này phù hợp cho lỗi tạm thời như Redis/DB/network lỗi ngắn hạn.

### 9.2 Retry nghiệp vụ bằng DB

Trong `scheduleRetryForAssignment`:

```ts
const maxRetries = 10;
const baseDelay = 1;
const delayMinutes = Math.min(baseDelay * Math.pow(2, assignment.attemptCount), 60);
const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000);

latestAssignment.attemptCount += 1;
latestAssignment.lastAttemptAt = new Date();
latestAssignment.nextAttemptAt = nextAttempt;
```

Ý nghĩa:

- Retry này dùng khi không tìm thấy shipper, shipper không phản hồi, hoặc cần thử lại sau.
- Delay tăng theo exponential backoff:
  - Lần 1: 1 phút
  - Lần 2: 2 phút
  - Lần 3: 4 phút
  - Lần 4: 8 phút
  - Tối đa 60 phút
- Tối đa 10 retries, sau đó xóa assignment.

Đây là retry nghiệp vụ, khác với retry kỹ thuật của BullMQ.

## 10. Delay

BullMQ wrapper có hỗ trợ:

```ts
delay: options?.delayMs
```

Nhưng flow `find-shipper` hiện tại không dùng BullMQ delay. Delay chính nằm trong DB bằng field:

```ts
nextAttemptAt
```

Cron chỉ enqueue job khi:

```ts
nextAttemptAt < new Date()
```

Cách này biến DB thành một scheduler riêng.

## 11. Priority

Dự án có 2 nơi dùng priority.

### 11.1 Priority trong DB

Cron query:

```ts
order: {
  priority: 'DESC',
  createdAt: 'ASC'
}
```

Nghĩa là số priority lớn hơn được xử lý trước.

### 11.2 Priority trong BullMQ

Job options:

```ts
priority: assignment.priority
```

Cần cẩn thận: BullMQ thường ưu tiên priority số nhỏ hơn trước. Trong khi comment/entity của dự án ghi:

```ts
// Higher number = higher priority
```

Đây là điểm có nguy cơ bị ngược priority nếu có nhiều job cùng lúc trong Redis.

## 12. Concurrency

Processor cấu hình:

```ts
@Processor(QueueNames.FIND_SHIPPER, {
  concurrency: 1,
})
```

Ý nghĩa:

- Mỗi instance worker chỉ xử lý 1 job tại một thời điểm.
- Cách này đơn giản và giảm race condition.
- Đổi lại throughput thấp. Nếu có nhiều order, queue có thể bị backlog.

Nếu scale lên production, có thể tăng concurrency, nhưng cần có lock/idempotency tốt hơn để tránh nhiều worker notify trùng shipper/order.

## 13. Rate limiting

Hiện tại chưa cấu hình rate limit cho BullMQ.

Không thấy cấu hình dạng này:

```ts
limiter: {
  max: 100,
  duration: 60000,
}
```

Nếu sau này có job gọi API ngoài, gửi push notification, SMS, email, nên thêm rate limiting để tránh bị quá tải hoặc bị third-party chặn.

## 14. Failed jobs và dead-letter jobs

### 14.1 Failed jobs

Job failed được cấu hình:

```ts
removeOnFail: 1000
```

Ý nghĩa:

- BullMQ giữ tối đa 1000 failed jobs.
- Khi quá giới hạn, job cũ có thể bị xóa.

### 14.2 Dead-letter queue

Hiện tại chưa có dead-letter queue.

Dead-letter queue là queue riêng để chứa các job đã retry hết nhưng vẫn thất bại, ví dụ:

```text
find-shipper-dead
```

Lợi ích:

- Admin có thể xem job nào thất bại vĩnh viễn.
- Có thể replay job sau khi fix bug.
- Không làm mất dữ liệu lỗi quan trọng.

Hiện tại, nếu assignment retry quá giới hạn, code sẽ xóa assignment:

```ts
await this.pendingAssignmentRepository.remove(assignment);
```

Điều này đơn giản nhưng mất khả năng audit/recovery.

## 15. Monitoring

Dự án có sẵn một số method monitoring trong `QueueService`:

```ts
getQueueSize
getPendingJobs
getQueueStats
getHealthStatus
```

Trong `PendingAssignmentService` có cron:

```ts
@Cron(CronExpression.EVERY_5_MINUTES)
async logSystemStats(): Promise<void> {
  const dbPendingCount = await this.pendingAssignmentRepository.count();
  const queueSize = await this.queueService.getQueueSize(QueueNames.FIND_SHIPPER);
}
```

Nhưng log đang bị comment, và không thấy dashboard/admin API rõ ràng.

Chưa thấy:

- Bull Board.
- QueueEvents.
- Metrics Prometheus/Grafana.
- Alert khi failed jobs tăng.
- Alert khi queue waiting/delayed tăng cao.

## 16. Pattern BullMQ dự án đang dùng

Dự án đang dùng nhiều pattern kết hợp.

### 16.1 Background jobs

Tìm shipper được đưa vào queue để worker xử lý nền. Request confirm order không cần xử lý hết logic tìm shipper ngay lập tức.

### 16.2 Async processing

Order confirmed trước, shipper assignment xử lý sau. Đây là async processing.

### 16.3 Scheduled polling

Cron mỗi 5 giây quét DB `pending_shipper_assignments`, sau đó mới enqueue job BullMQ.

### 16.4 Event-driven notification

Worker publish event:

```ts
pubSub.publish('orderConfirmedForShippers', ...)
```

Shipper client có thể nhận event qua GraphQL subscription.

### 16.5 DB-backed state machine

Bảng `pending_shipper_assignments` giữ trạng thái:

- Đang chờ xử lý.
- Đã gửi cho shipper.
- Đang đợi retry.
- Đã quá số lần retry.

### 16.6 Chưa phải outbox pattern chuẩn

Outbox pattern thường gồm:

1. Ghi business data và event vào DB trong cùng transaction.
2. Một worker đọc outbox table.
3. Publish event/enqueue job đảm bảo không mất event.

Dự án có DB pending assignment, nhưng chưa có outbox event table và chưa đảm bảo atomic giữa việc update DB, enqueue BullMQ, publish PubSub.

## 17. Điểm tốt của setup hiện tại

- Đã tách `QueueService`, `Processor`, và business service.
- Worker reload data từ DB, không tin hoàn toàn vào payload job.
- Có `jobId` tùy chỉnh để giảm duplicate.
- Có retry kỹ thuật BullMQ.
- Có retry nghiệp vụ bằng `nextAttemptAt`.
- Có check order status và shipping detail trước khi notify shipper.
- Có timeout 2 phút khi shipper không phản hồi.
- Redis Docker có AOF persistence.

## 18. Điểm chưa tối ưu và rủi ro scalability

### 18.1 Tên folder và code legacy gây nhầm lẫn

Business service vẫn nằm trong:

```text
src/pg-boss/pending-assignment.service.ts
```

Trong khi runtime queue dùng BullMQ. Ngoài ra package `pg-boss` vẫn còn trong `package.json`.

Rủi ro:

- Người mới đọc code dễ nhầm là dự án đang dùng pg-boss.
- Bảo trì khó.
- Có thể sửa nhầm file legacy.

### 18.2 Hai lớp retry chồng nhau

Khi job lỗi:

- Code trong catch gọi `scheduleRetryForAssignment`.
- Sau đó throw error.
- BullMQ lại retry job cũ.

Rủi ro:

- Một lỗi có thể tạo cả business retry và BullMQ retry.
- Attempt count DB và attempts BullMQ có thể không đồng bộ.
- Có thể notify lặp lại nếu race condition.

### 18.3 Cron chạy trên mỗi instance

Nếu deploy 3 replicas backend, cả 3 cùng chạy:

```ts
@Cron(CronExpression.EVERY_5_SECONDS)
```

Rủi ro:

- Nhiều instance cùng quét một assignment.
- Nhiều instance cùng cố gắng enqueue job.
- `jobId` có giảm duplicate nhưng không phải giải pháp lock hoàn chỉnh.

### 18.4 `isSentToShipper` set hơi muộn

Flag này chỉ set sau khi worker publish thành công. Trong lúc job đã enqueue nhưng chưa process, assignment vẫn `false`.

Rủi ro:

- Cron lần tiếp theo có thể tiếp tục nhìn thấy assignment và tạo job duplicate.

### 18.5 Priority có thể bị ngược

DB sort `priority DESC`, nhưng BullMQ priority có semantics khác. Nếu dùng BullMQ priority thật sự, cần kiểm tra và map lại.

### 18.6 Concurrency = 1 có thể thành nút thắt cổ chai

An toàn cho giai đoạn đầu, nhưng khi đơn hàng tăng, worker xử lý lần lượt sẽ chậm.

### 18.7 Chưa có monitoring production

Thiếu dashboard, alert, metrics, QueueEvents. Nếu queue bị kẹt, team có thể không biết kịp.

### 18.8 Chưa có dead-letter queue

Job/assignment thất bại quá giới hạn có thể bị xóa, khó điều tra sau này.

### 18.9 Redis dùng chung cache và queue

Dự án có `src/cache` cũng dùng Redis DB mặc định `0`. Nếu cache và BullMQ dùng cùng Redis DB/prefix, việc vận hành sẽ khó hơn.

### 18.10 Redis `noeviction` với maxmemory 256mb

Khi Redis đầy, queue/cache write có thể fail. Với BullMQ, Redis đầy là rủi ro nghiêm trọng.

## 19. Đề xuất cải thiện

### 19.1 Dọn dẹp code migration

Nên chuyển business service sang đúng folder đúng tên:

```text
src/queue/pending-assignment.service.ts
```

Sau đó:

- Xóa hoặc archive `src/pg-boss`.
- Gỡ bỏ `pg-boss` nếu không dùng.
- Cập nhật docs/comment.

### 19.2 Chọn một retry model rõ ràng

Nên tách:

- Lỗi kỹ thuật: để BullMQ retry.
- Không có shipper/shipper timeout: không throw error, chỉ schedule business retry.

Ví dụ:

- Nếu DB connection lỗi: throw để BullMQ retry.
- Nếu không tìm thấy shipper: update `nextAttemptAt`, return success.

### 19.3 Thêm lock khi cron quét DB

Nếu scale nhiều instance, nên dùng:

- PostgreSQL advisory lock.
- Query `FOR UPDATE SKIP LOCKED`.
- Hoặc bỏ cron DB polling, dùng BullMQ delayed jobs thay cho `nextAttemptAt`.

### 19.4 Sửa priority mapping

Nếu business muốn số lớn hơn ưu tiên hơn, có thể map:

```ts
priority: MAX_PRIORITY - assignment.priority
```

Hoặc bỏ BullMQ priority và chỉ rely vào DB sort.

### 19.5 Thêm dead-letter queue

Tạo queue mới:

```text
find-shipper-dead
```

Khi assignment quá max retry:

- Lưu reason.
- Lưu orderId, assignmentId, attemptCount.
- Cho admin xem và retry thủ công.

### 19.6 Thêm dashboard monitoring

Có thể dùng Bull Board:

```text
@bull-board/api
@bull-board/express
```

Theo dõi:

- waiting
- active
- delayed
- failed
- completed
- duration
- failed reason

### 19.7 Thêm QueueEvents

Dùng QueueEvents để log/metrics:

- completed
- failed
- stalled
- progress

### 19.8 Tăng concurrency có kiểm soát

Sau khi có lock/idempotency tốt, có thể tăng:

```ts
concurrency: 3
```

Hoặc cao hơn tùy tải.

### 19.9 Tuyên bố Redis prefix/db riêng

Nên tách Redis cho BullMQ và cache:

- Cache: DB 0.
- BullMQ: DB 1.

Hoặc set key prefix riêng cho BullMQ.

### 19.10 Giữ completed jobs có giới hạn

Thay vì:

```ts
removeOnComplete: true
```

Có thể dùng:

```ts
removeOnComplete: {
  age: 24 * 3600,
  count: 1000,
}
```

Như vậy vẫn giữ được một phần lịch sử để debug.

## 20. Tóm tắt ngắn gọn

BullMQ trong dự án Foodee hiện phục vụ một feature chính: tự động tìm shipper cho order đã confirmed.

Flow cốt lõi:

```text
Order confirmed
  -> tạo PendingShipperAssignment trong DB
  -> cron mỗi 5 giây quét assignment đến hạn
  -> QueueService add job vào BullMQ queue find-shipper
  -> FindShipperProcessor nhận job
  -> PendingAssignmentService reload order/assignment
  -> tìm shipper gần nhất
  -> publish GraphQL event cho shipper
  -> đợi shipper phản hồi 2 phút
  -> accept thì tạo ShippingDetail và xóa assignment
  -> reject/timeout/no shipper thì schedule retry
```

Setup hiện tại dùng được cho giai đoạn development/small production, nhưng để production-ready hơn cần ưu tiên:

1. Dọn dẹp code legacy pg-boss.
2. Giảm retry chồng nhau.
3. Thêm lock cho cron khi scale nhiều instance.
4. Thêm monitoring và dead-letter queue.
5. Tính lại priority của BullMQ.
6. Tách Redis/prefix cho queue và cache.
