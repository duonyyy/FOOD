# Phan tich BullMQ trong du an Fooddie Backend

Tai lieu nay giai thich cach du an dang dung BullMQ theo huong de tiep can cho nguoi moi. Muc tieu la giup ban hieu:

- BullMQ la gi va vi sao can queue.
- Du an setup BullMQ o dau.
- Queue nao dang duoc dung.
- Flow producer -> queue -> worker -> job processing chay nhu the nao.
- Retry, delay, priority, concurrency, failed jobs va monitoring dang duoc xu ly ra sao.
- Setup hien tai da production-ready chua va nen cai thien gi.

## 1. BullMQ la gi?

BullMQ la thu vien queue cho Node.js, dung Redis de luu va dieu phoi cac job chay nen. Thay vi xu ly moi viec ngay trong request HTTP, ung dung co the dua cong viec vao hang doi, sau do worker xu ly sau.

Vi du trong du an Fooddie:

1. Nha hang xac nhan don hang.
2. He thong can tim shipper gan nhat.
3. Viec tim shipper co the mat thoi gian, can retry, can tranh trung lap.
4. Thay vi lam tat ca trong request xac nhan don, du an tao mot pending assignment va dua job vao BullMQ.
5. Worker lay job ra xu ly va gui thong bao cho shipper.

Mot so khai niem chinh:

- Producer: noi tao job va day vao queue.
- Queue: hang doi luu job trong Redis.
- Worker/Processor: noi lay job tu queue va xu ly.
- Job: mot don vi cong viec, gom ten, data va options.
- Redis: noi BullMQ luu trang thai queue/job.

## 2. Kien truc BullMQ tong the trong du an

Phan BullMQ chinh nam trong thu muc:

```text
src/queue
```

Cac file quan trong:

```text
src/queue/queue.module.ts
src/queue/queue.service.ts
src/queue/queue.constants.ts
src/queue/processors/find-shipper.processor.ts
src/queue/pending-assignment.service.ts
```

Luu y quan trong: file `src/queue/pending-assignment.service.ts` hien chi re-export service tu:

```text
src/pg-boss/pending-assignment.service.ts
```

Nghia la logic nghiep vu gan shipper van nam trong folder co ten `pg-boss`, nhung queue runtime hien tai dang dung BullMQ. Day la dau vet cua viec migrate tu pg-boss sang BullMQ.

## 3. Redis connection

Redis duoc cau hinh trong `src/queue/queue.module.ts`:

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

Y nghia:

- `REDIS_HOST`: host Redis, mac dinh `localhost`.
- `REDIS_PORT`: port Redis, mac dinh `6379`.
- `REDIS_PASSWORD`: password neu Redis co dat mat khau.
- `REDIS_DB`: database index cua Redis, mac dinh `0`.
- `maxRetriesPerRequest: null`: cau hinh phu hop voi BullMQ/ioredis de worker co the hoat dong on dinh voi blocking commands.

Trong `docker-compose.yml`, Redis duoc khai bao:

```yaml
redis:
  image: redis:7-alpine
  container_name: fooddie_redis
  restart: unless-stopped
  command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"]
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

Y nghia:

- `appendonly yes`: bat AOF persistence, Redis ghi log de khoi phuc du lieu sau restart.
- `maxmemory 256mb`: gioi han bo nho Redis.
- `noeviction`: khi day bo nho, Redis khong tu xoa key ma se bao loi ghi moi.

## 4. Queue duoc register

Queue names nam trong `src/queue/queue.constants.ts`:

```ts
export const QueueNames = {
  FIND_SHIPPER: 'find-shipper',
  NOTIFY_SHIPPERS: 'notify-shippers',
} as const;
```

Hien tai chi co queue `find-shipper` duoc register that su trong `queue.module.ts`:

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

Y nghia:

- Queue ten `find-shipper`.
- Moi job mac dinh retry toi da 3 lan.
- Moi lan retry cach nhau 5000ms.
- Job thanh cong se bi xoa khoi Redis.
- Job failed duoc giu toi da 1000 job.

`NOTIFY_SHIPPERS` moi chi duoc khai bao hang so, chua duoc register va chua co processor.

## 5. QueueService: lop wrapper quanh BullMQ

File:

```text
src/queue/queue.service.ts
```

Service nay dong vai tro la lop trung gian de cac feature khac khong can goi truc tiep BullMQ API.

### 5.1 Inject queue

```ts
constructor(
  @InjectQueue(QueueNames.FIND_SHIPPER)
  private readonly findShipperQueue: Queue,
) {
  this.logger.log('QueueService initialized with BullMQ');
}
```

Y nghia:

- NestJS inject queue `find-shipper` vao service.
- `findShipperQueue` la object BullMQ `Queue`.
- Cac method ben duoi se dung object nay de add job, get stats, cancel job.

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

Y nghia:

- Nhan `queueName`, `jobData`, `options`.
- Lay queue tu `getQueue`.
- Goi `queue.add(...)` de tao job trong Redis.
- Tra ve `job.id`.

Trong du an, job name dang duoc dat bang chinh ten queue:

```ts
queue.add(queueName, jobData, options)
```

Vi du job cua queue `find-shipper` cung co name la `find-shipper`.

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

Y nghia:

- `attempts`: so lan BullMQ retry neu job throw error.
- `backoff`: khoang cach giua cac lan retry.
- `delay`: tri hoan job truoc khi worker co the xu ly.
- `priority`: do uu tien cua job.
- `jobId`: id tuy chinh, giup tranh duplicate job.
- `removeOnComplete`: xoa job sau khi thanh cong.
- `removeOnFail`: giu failed jobs theo so luong hoac xoa tuy cau hinh.

### 5.4 Queue stats va health

QueueService co cac method:

```ts
getQueueSize(queueName)
getPendingJobs(queueName, limit)
getQueueStats(queueName)
cancelJob(queueName, jobId)
archiveCompletedJobs(queueName)
purgeArchivedJobs(queueName)
getHealthStatus()
```

Y nghia:

- `getQueueSize`: dem job dang `waiting`, `delayed`, `prioritized`.
- `getPendingJobs`: lay danh sach job dang cho.
- `getQueueStats`: tra ve size va 5 pending jobs dau tien.
- `cancelJob`: xoa job theo id.
- `archiveCompletedJobs`: clean completed jobs cu hon 24h.
- `purgeArchivedJobs`: clean failed jobs cu hon 7 ngay.
- `getHealthStatus`: goi `getJobCounts` de kiem tra queue co hoat dong khong.

Hien tai cac method nay chua thay duoc expose thanh admin API rieng.

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

Y nghia:

- `@Processor(QueueNames.FIND_SHIPPER)`: class nay la worker cua queue `find-shipper`.
- `concurrency: 1`: moi process chi xu ly 1 job cung luc.
- `process(job)`: ham chay moi khi co job.
- Neu xu ly loi, worker throw lai error de BullMQ danh dau job failed va retry theo cau hinh.

Worker khong chua nhieu business logic. No chi forward job sang `PendingAssignmentService`.

## 7. Feature dung BullMQ: tu dong tim shipper

Feature chinh cua BullMQ trong du an la:

```text
Tu dong tim va thong bao shipper gan nhat cho don hang da confirmed.
```

Business logic nam trong:

```text
src/pg-boss/pending-assignment.service.ts
```

Mac du folder la `pg-boss`, class nay hien dang duoc BullMQ processor goi vao.

## 8. Flow chi tiet: producer -> queue -> worker -> job processing

### Buoc 1: Order duoc confirmed

Trong `src/modules/order/order.service.ts`, method `confirmOrder`:

```ts
order.status = 'confirmed';
const confirmedOrder = await this.orderRepository.save(order);

const pendingAssignment = await this.pendingAssignmentService.addPendingAssignment(
  confirmedOrder.id,
  1
);
```

Y nghia:

- Khi nha hang xac nhan order, status chuyen sang `confirmed`.
- He thong tao mot pending assignment cho order nay.
- Priority mac dinh la `1`.

Ngoai ra trong `src/modules/order/order.controller.ts`, neu restaurant update status sang `confirmed`, controller cung goi:

```ts
await this.pendingAssignmentService.addPendingAssignment(id, 1);
```

### Buoc 2: Luu pending assignment vao DB

Entity:

```text
src/entities/pendingShipperAssignment.entity.ts
```

Cac field quan trong:

```ts
priority: number;
attemptCount: number;
lastAttemptAt: Date;
nextAttemptAt: Date;
createdAt: Date;
isSentToShipper: boolean;
```

Y nghia:

- `priority`: do uu tien cua assignment.
- `attemptCount`: da thu tim shipper bao nhieu lan.
- `nextAttemptAt`: luc nao duoc thu tiep.
- `isSentToShipper`: da gui loi moi cho shipper va dang cho phan hoi hay chua.

Method tao record:

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

Y nghia:

- Assignment moi se duoc xu ly ngay vi `nextAttemptAt = now`.
- Ban dau chua gui cho shipper nao.

### Buoc 3: Cron quet pending assignments

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

Y nghia:

- Cu 5 giay, service vao DB lay cac assignment da den luc xu ly.
- Lay toi da 50 record moi lan.
- Uu tien assignment co `priority` cao hon.
- Neu cung priority, order cu hon duoc xu ly truoc.

### Buoc 4: Validate assignment truoc khi enqueue

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

Y nghia:

- Chi tim shipper cho order con `confirmed`.
- Neu order da co shipper thi bo qua.
- Neu da gui cho mot shipper va dang doi phan hoi thi bo qua.
- Neu qua so lan thu hoac qua tuoi doi thi khong xu ly nua.

### Buoc 5: Producer tao job BullMQ

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

Y nghia:

- Job data chi nen gom du lieu can thiet: assignment id, order id, attempt.
- Worker se reload du lieu moi nhat tu DB khi xu ly.
- `jobId` co dang deterministic de giam duplicate.
- Job co retry ky thuat 3 lan neu worker throw error.

### Buoc 6: BullMQ luu job vao Redis

Khi `queue.add(...)` duoc goi:

- BullMQ ghi job vao Redis.
- Job vao trang thai waiting/prioritized/delayed tuy options.
- Worker dang lang nghe queue `find-shipper` se lay job ra xu ly.

### Buoc 7: Worker nhan job

```ts
async process(job: Job<FindShipperJobData>): Promise<void> {
  await this.pendingAssignmentService.processShipperAssignmentJobData(String(job.id), job.data);
}
```

Y nghia:

- Worker khong xu ly truc tiep.
- Worker goi service nghiep vu de xu ly.
- Neu service throw error, BullMQ se retry/fail job.

### Buoc 8: Xu ly job tim shipper

Trong `processShipperAssignmentJobData`:

```ts
const assignment = await this.pendingAssignmentRepository.findOne({
  where: { id: pendingAssignmentId },
  relations: ['order', 'order.restaurant', 'order.user', 'order.address', 'order.orderDetails', 'order.orderDetails.food']
});
```

Y nghia:

- Worker reload assignment va order tu DB.
- Cach nay tot hon viec dua ca object order vao job data, vi du lieu trong DB co the da thay doi.

Sau do validate:

```ts
if (order.status !== 'confirmed') {
  await this.pendingAssignmentRepository.remove(assignment);
  this.shipperTracker.clearOrder(orderId);
  return;
}
```

Neu order khong con confirmed, assignment bi xoa.

Check da co shipper:

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

Neu order da co shipping detail, khong can tim shipper nua.

### Buoc 9: Tim shipper gan nhat

```ts
const nearestShipper = await this.findNearestAvailableShipper(order);
```

`findNearestAvailableShipper` lay danh sach shipper dang active tu:

```ts
activeShipperTracker.getAllShippers()
```

Sau do:

- Bo qua shipper da duoc notify cho order nay.
- Tinh khoang cach bang `haversineDistance`.
- Chon shipper gan nha hang nhat va nam trong `maxDistance`.

Neu khong tim thay shipper:

```ts
await this.scheduleRetryForAssignment(assignment);
return;
```

### Buoc 10: Publish thong bao cho shipper

Neu tim duoc shipper:

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

Y nghia:

- Worker gui event qua GraphQL PubSub.
- Client shipper co the subscribe event va nhan don.
- Payload kem thong tin tien ship, loi nhuan, khoang cach.

Sau khi publish thanh cong:

```ts
assignment.isSentToShipper = true;
await this.pendingAssignmentRepository.save(assignment);
this.shipperTracker.addNotifiedShipper(orderId, nearestShipper.shipperId);
```

Y nghia:

- Danh dau order dang duoc gui cho shipper.
- Tranh cron tiep tuc tao job moi cho assignment nay trong luc doi shipper tra loi.
- Ghi nho shipper da duoc hoi de lan sau khong hoi lai cung nguoi.

### Buoc 11: Timeout neu shipper khong phan hoi

```ts
this.shipperTracker.setResponseTimeout(orderId, async () => {
  latestAssignment.isSentToShipper = false;
  await this.pendingAssignmentRepository.save(latestAssignment);
  await this.scheduleRetryForAssignment(latestAssignment);
}, 2 * 60 * 1000);
```

Y nghia:

- Shipper co 2 phut de phan hoi.
- Neu het 2 phut ma khong co ket qua, reset `isSentToShipper = false`.
- Sau do schedule retry de tim shipper khac.

### Buoc 12: Khi shipper chap nhan

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

Y nghia:

- Tao shipping detail gan order voi shipper.
- Doi status order sang `shipper_received`.
- Xoa pending assignment vi order da co shipper.

### Buoc 13: Khi shipper tu choi

Trong `rejectOrder`:

```ts
await this.pendingShipperAssignmentRepository.update(
  { order: { id: orderId } },
  { isSentToShipper: false }
);
```

Y nghia:

- Mo khoa assignment.
- Cron co the lay assignment nay len va tao job tim shipper khac.

## 9. Retry trong du an

Du an hien co 2 lop retry.

### 9.1 Retry ky thuat cua BullMQ

Cau hinh:

```ts
attempts: 3,
backoff: {
  type: 'fixed',
  delay: 5000,
}
```

Neu worker throw error:

1. BullMQ danh dau job failed tam thoi.
2. Cho 5 giay.
3. Chay lai job.
4. Sau 3 lan van loi thi job failed that su.

Retry nay phu hop cho loi tam thoi nhu Redis/DB/network loi ngan han.

### 9.2 Retry nghiep vu bang DB

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

Y nghia:

- Retry nay dung khi khong tim thay shipper, shipper khong phan hoi, hoac can thu lai sau.
- Delay tang theo exponential backoff:
  - Lan 1: 1 phut
  - Lan 2: 2 phut
  - Lan 3: 4 phut
  - Lan 4: 8 phut
  - Toi da 60 phut
- Toi da 10 retries, sau do xoa assignment.

Day la retry nghiep vu, khac voi retry ky thuat cua BullMQ.

## 10. Delay

BullMQ wrapper co ho tro:

```ts
delay: options?.delayMs
```

Nhung flow `find-shipper` hien tai khong dung BullMQ delay. Delay chinh nam trong DB bang field:

```ts
nextAttemptAt
```

Cron chi enqueue job khi:

```ts
nextAttemptAt < new Date()
```

Cach nay bien DB thanh mot scheduler rieng.

## 11. Priority

Du an co 2 noi dung priority.

### 11.1 Priority trong DB

Cron query:

```ts
order: {
  priority: 'DESC',
  createdAt: 'ASC'
}
```

Nghia la so priority lon hon duoc xu ly truoc.

### 11.2 Priority trong BullMQ

Job options:

```ts
priority: assignment.priority
```

Can can than: BullMQ thuong uu tien priority so nho hon truoc. Trong khi comment/entity cua du an ghi:

```ts
// Higher number = higher priority
```

Day la diem co nguy co bi nguoc priority neu co nhieu job cung luc trong Redis.

## 12. Concurrency

Processor cau hinh:

```ts
@Processor(QueueNames.FIND_SHIPPER, {
  concurrency: 1,
})
```

Y nghia:

- Moi instance worker chi xu ly 1 job tai mot thoi diem.
- Cach nay don gian va giam race condition.
- Doi lai throughput thap. Neu co nhieu order, queue co the bi backlog.

Neu scale len production, co the tang concurrency, nhung can co lock/idempotency tot hon de tranh nhieu worker notify trung shipper/order.

## 13. Rate limiting

Hien tai chua cau hinh rate limit cho BullMQ.

Khong thay cau hinh dang nay:

```ts
limiter: {
  max: 100,
  duration: 60000,
}
```

Neu sau nay co job goi API ngoai, gui push notification, SMS, email, nen them rate limiting de tranh bi qua tai hoac bi third-party chan.

## 14. Failed jobs va dead-letter jobs

### 14.1 Failed jobs

Job failed duoc cau hinh:

```ts
removeOnFail: 1000
```

Y nghia:

- BullMQ giu toi da 1000 failed jobs.
- Khi qua gioi han, job cu co the bi xoa.

### 14.2 Dead-letter queue

Hien tai chua co dead-letter queue.

Dead-letter queue la queue rieng de chua cac job da retry het nhung van that bai, vi du:

```text
find-shipper-dead
```

Loi ich:

- Admin co the xem job nao that bai vinh vien.
- Co the replay job sau khi fix bug.
- Khong lam mat du lieu loi quan trong.

Hien tai, neu assignment retry qua gioi han, code se xoa assignment:

```ts
await this.pendingAssignmentRepository.remove(assignment);
```

Dieu nay don gian nhung mat kha nang audit/recovery.

## 15. Monitoring

Du an co san mot so method monitoring trong `QueueService`:

```ts
getQueueSize
getPendingJobs
getQueueStats
getHealthStatus
```

Trong `PendingAssignmentService` co cron:

```ts
@Cron(CronExpression.EVERY_5_MINUTES)
async logSystemStats(): Promise<void> {
  const dbPendingCount = await this.pendingAssignmentRepository.count();
  const queueSize = await this.queueService.getQueueSize(QueueNames.FIND_SHIPPER);
}
```

Nhung log dang bi comment, va khong thay dashboard/admin API ro rang.

Chua thay:

- Bull Board.
- QueueEvents.
- Metrics Prometheus/Grafana.
- Alert khi failed jobs tang.
- Alert khi queue waiting/delayed tang cao.

## 16. Pattern BullMQ du an dang dung

Du an dang dung nhieu pattern ket hop.

### 16.1 Background jobs

Tim shipper duoc dua vao queue de worker xu ly nen. Request confirm order khong can xu ly het logic tim shipper ngay lap tuc.

### 16.2 Async processing

Order confirmed truoc, shipper assignment xu ly sau. Day la async processing.

### 16.3 Scheduled polling

Cron moi 5 giay quet DB `pending_shipper_assignments`, sau do moi enqueue job BullMQ.

### 16.4 Event-driven notification

Worker publish event:

```ts
pubSub.publish('orderConfirmedForShippers', ...)
```

Shipper client co the nhan event qua GraphQL subscription.

### 16.5 DB-backed state machine

Bang `pending_shipper_assignments` giu trang thai:

- Dang cho xu ly.
- Da gui cho shipper.
- Dang doi retry.
- Da qua so lan retry.

### 16.6 Chua phai outbox pattern chuan

Outbox pattern thuong gom:

1. Ghi business data va event vao DB trong cung transaction.
2. Mot worker doc outbox table.
3. Publish event/enqueue job dam bao khong mat event.

Du an co DB pending assignment, nhung chua co outbox event table va chua dam bao atomic giua viec update DB, enqueue BullMQ, publish PubSub.

## 17. Diem tot cua setup hien tai

- Da tach `QueueService`, `Processor`, va business service.
- Worker reload data tu DB, khong tin hoan toan vao payload job.
- Co `jobId` tuy chinh de giam duplicate.
- Co retry ky thuat BullMQ.
- Co retry nghiep vu bang `nextAttemptAt`.
- Co check order status va shipping detail truoc khi notify shipper.
- Co timeout 2 phut khi shipper khong phan hoi.
- Redis Docker co AOF persistence.

## 18. Diem chua toi uu va rui ro scalability

### 18.1 Ten folder va code legacy gay nham lan

Business service van nam trong:

```text
src/pg-boss/pending-assignment.service.ts
```

Trong khi runtime queue dung BullMQ. Ngoai ra package `pg-boss` van con trong `package.json`.

Rui ro:

- Nguoi moi doc code de nham la du an dang dung pg-boss.
- Bao tri kho.
- Co the sua nham file legacy.

### 18.2 Hai lop retry chong nhau

Khi job loi:

- Code trong catch goi `scheduleRetryForAssignment`.
- Sau do throw error.
- BullMQ lai retry job cu.

Rui ro:

- Mot loi co the tao ca business retry va BullMQ retry.
- Attempt count DB va attempts BullMQ co the khong dong bo.
- Co the notify lap lai neu race condition.

### 18.3 Cron chay tren moi instance

Neu deploy 3 replicas backend, ca 3 cung chay:

```ts
@Cron(CronExpression.EVERY_5_SECONDS)
```

Rui ro:

- Nhieu instance cung quet mot assignment.
- Nhieu instance cung co gang enqueue job.
- `jobId` co giam duplicate nhung khong phai giai phap lock hoan chinh.

### 18.4 `isSentToShipper` set hoi muon

Flag nay chi set sau khi worker publish thanh cong. Trong luc job da enqueue nhung chua process, assignment van `false`.

Rui ro:

- Cron lan tiep theo co the tiep tuc nhin thay assignment va tao job duplicate.

### 18.5 Priority co the bi nguoc

DB sort `priority DESC`, nhung BullMQ priority co semantics khac. Neu dung BullMQ priority that su, can kiem tra va map lai.

### 18.6 Concurrency = 1 co the thanh nut that co chai

An toan cho giai doan dau, nhung khi don hang tang, worker xu ly lan luot se cham.

### 18.7 Chua co monitoring production

Thieu dashboard, alert, metrics, QueueEvents. Neu queue bi ket, team co the khong biet kip.

### 18.8 Chua co dead-letter queue

Job/assignment that bai qua gioi han co the bi xoa, kho dieu tra sau nay.

### 18.9 Redis dung chung cache va queue

Du an co `src/cache` cung dung Redis DB mac dinh `0`. Neu cache va BullMQ dung cung Redis DB/prefix, viec van hanh se kho hon.

### 18.10 Redis `noeviction` voi maxmemory 256mb

Khi Redis day, queue/cache write co the fail. Voi BullMQ, Redis day la rui ro nghiem trong.

## 19. De xuat cai thien

### 19.1 Don dep code migration

Nen chuyen business service sang dung folder dung ten:

```text
src/queue/pending-assignment.service.ts
```

Sau do:

- Xoa hoac archive `src/pg-boss`.
- Go bo `pg-boss` neu khong dung.
- Cap nhat docs/comment.

### 19.2 Chon mot retry model ro rang

Nen tach:

- Loi ky thuat: de BullMQ retry.
- Khong co shipper/shipper timeout: khong throw error, chi schedule business retry.

Vi du:

- Neu DB connection loi: throw de BullMQ retry.
- Neu khong tim thay shipper: update `nextAttemptAt`, return success.

### 19.3 Them lock khi cron quet DB

Neu scale nhieu instance, nen dung:

- PostgreSQL advisory lock.
- Query `FOR UPDATE SKIP LOCKED`.
- Hoac bo cron DB polling, dung BullMQ delayed jobs thay cho `nextAttemptAt`.

### 19.4 Sua priority mapping

Neu business muon so lon hon uu tien hon, co the map:

```ts
priority: MAX_PRIORITY - assignment.priority
```

Hoac bo BullMQ priority va chi rely vao DB sort.

### 19.5 Them dead-letter queue

Tao queue moi:

```text
find-shipper-dead
```

Khi assignment qua max retry:

- Luu reason.
- Luu orderId, assignmentId, attemptCount.
- Cho admin xem va retry thu cong.

### 19.6 Them dashboard monitoring

Co the dung Bull Board:

```text
@bull-board/api
@bull-board/express
```

Theo doi:

- waiting
- active
- delayed
- failed
- completed
- duration
- failed reason

### 19.7 Them QueueEvents

Dung QueueEvents de log/metrics:

- completed
- failed
- stalled
- progress

### 19.8 Tang concurrency co kiem soat

Sau khi co lock/idempotency tot, co the tang:

```ts
concurrency: 3
```

Hoac cao hon tuy tai.

### 19.9 Tuyen bo Redis prefix/db rieng

Nen tach Redis cho BullMQ va cache:

- Cache: DB 0.
- BullMQ: DB 1.

Hoac set key prefix rieng cho BullMQ.

### 19.10 Giu completed jobs co gioi han

Thay vi:

```ts
removeOnComplete: true
```

Co the dung:

```ts
removeOnComplete: {
  age: 24 * 3600,
  count: 1000,
}
```

Nhu vay van giu duoc mot phan lich su de debug.

## 20. Tom tat ngan gon

BullMQ trong du an Fooddie hien phuc vu mot feature chinh: tu dong tim shipper cho order da confirmed.

Flow cot loi:

```text
Order confirmed
  -> tao PendingShipperAssignment trong DB
  -> cron moi 5 giay quet assignment den han
  -> QueueService add job vao BullMQ queue find-shipper
  -> FindShipperProcessor nhan job
  -> PendingAssignmentService reload order/assignment
  -> tim shipper gan nhat
  -> publish GraphQL event cho shipper
  -> doi shipper phan hoi 2 phut
  -> accept thi tao ShippingDetail va xoa assignment
  -> reject/timeout/no shipper thi schedule retry
```

Setup hien tai dung duoc cho giai doan development/small production, nhung de production-ready hon can uu tien:

1. Don dep code legacy pg-boss.
2. Giam retry chong nhau.
3. Them lock cho cron khi scale nhieu instance.
4. Them monitoring va dead-letter queue.
5. Tinh lai priority cua BullMQ.
6. Tach Redis/prefix cho queue va cache.
