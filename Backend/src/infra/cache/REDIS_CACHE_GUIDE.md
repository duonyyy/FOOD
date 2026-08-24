# Redis Cache Implementation Guide

Tai lieu nay tom tat cach Redis cache da duoc trien khai trong du an, de lan sau co the ap dung lai cho API/module khac.

## 1. Them Redis vao Docker

Trong `docker-compose.yml`, them service Redis:

```yml
redis:
  image: redis:7-alpine
  container_name: fooddie_redis
  restart: unless-stopped
  command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Va them volume:

```yml
volumes:
  redis_data:
```

Trong service `api`, them bien moi truong:

```yml
environment:
  - REDIS_HOST=redis
  - REDIS_PORT=6379
```

Ly do:

- `appendonly yes`: Redis co persistent log, an toan hon khi container restart.
- `maxmemory 256mb`: gioi han memory de tranh Redis an het RAM.
- `allkeys-lru`: khi day memory, Redis xoa key it duoc dung gan day.
- `healthcheck`: API chi start khi Redis san sang.

## 2. Cai package Redis client

Dung `ioredis`:

```bash
npm install ioredis
```

Ly do chon `ioredis`:

- On dinh trong production.
- Ho tro Redis URL, password, db index.
- Co retry strategy va lazy connect.
- De dung truc tiep cho cache service rieng.

## 3. Tao CacheModule rieng

Thu muc da tao:

```txt
src/cache/
  cache.constants.ts
  cache-key.util.ts
  cache.module.ts
  cache.service.ts
```

### `cache.constants.ts`

Chua Redis provider token va TTL dung chung:

```ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const CACHE_TTL_SECONDS = {
  SHORT: 30,
  MEDIUM: 60,
  LONG: 300,
  VERY_LONG: 1800,
} as const;
```

### `cache-key.util.ts`

Dung de tao cache key on dinh tu object params:

```ts
buildCacheKey('food:findAll', { page, pageSize, status, sortBy });
```

Ket qua se co dang:

```txt
food:findAll:<base64url-json>
```

Loi ich:

- Params duoc sort key truoc khi stringify.
- Tranh loi key bi khac nhau do thu tu field object.
- Khong can noi chuoi thu cong dai va de sai.

### `cache.module.ts`

Dang ky Redis client va export `AppCacheService`.

Module nay duoc danh dau `@Global()`, nen cac service khac co the inject `AppCacheService` ma khong can import lai o tung module.

Ho tro 2 cach config:

```env
REDIS_URL=redis://default:password@host:6379/0
```

Hoac:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### `cache.service.ts`

Wrapper Redis gom cac method chinh:

```ts
get<T>(key)
set<T>(key, value, ttlSeconds)
remember<T>(key, ttlSeconds, loader)
delete(key)
deleteByPattern(pattern)
```

Pattern quan trong nhat la `remember`:

```ts
return this.cacheService.remember(cacheKey, CACHE_TTL_SECONDS.MEDIUM, async () => {
  return this.repository.find();
});
```

Nghia la:

1. Thu doc Redis.
2. Neu co cache thi return ngay.
3. Neu khong co cache thi query DB.
4. Luu ket qua vao Redis voi TTL.
5. Return ket qua.

## 4. Import CacheModule vao AppModule

Trong `src/app.module.ts`:

```ts
import { AppCacheModule } from './cache/cache.module';
```

Them vao `imports`:

```ts
AppCacheModule,
```

## 5. Cache thu cong trong service

Khong bat global cache cho tat ca API. Cache thu cong trong service de kiem soat:

- Cache key.
- TTL.
- Khi nao invalidate.
- API nao duoc cache, API nao khong.

Vi du voi API list:

```ts
async findAll(page = 1, pageSize = 10) {
  const cacheKey = buildCacheKey('category:findAll', { page, pageSize });

  return this.cacheService.remember(cacheKey, CACHE_TTL_SECONDS.VERY_LONG, async () => {
    const [items, totalItems] = await this.categoryRepository.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  });
}
```

Vi du voi API detail:

```ts
async findOne(id: string) {
  const cacheKey = buildCacheKey('category:findOne', { id });

  return this.cacheService.remember(cacheKey, CACHE_TTL_SECONDS.LONG, async () => {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['foods'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  });
}
```

## 6. Invalidate cache khi mutation

Day la phan quan trong nhat.

Neu chi cache ma khong xoa cache khi create/update/delete, user co the thay du lieu cu.

Moi service nen co helper rieng:

```ts
private async clearCategoryCache(): Promise<void> {
  await Promise.all([
    this.cacheService.deleteByPattern('category:*'),
    this.cacheService.deleteByPattern('food:*'),
  ]);
}
```

Sau khi create/update/delete thanh cong:

```ts
const savedCategory = await this.categoryRepository.save(category);
await this.clearCategoryCache();
return savedCategory;
```

Voi domain co lien quan nhau, invalidate rong hon:

```ts
private async clearFoodCache(foodId?: string, restaurantId?: string, categoryId?: string): Promise<void> {
  await Promise.all([
    this.cacheService.deleteByPattern('food:*'),
    this.cacheService.deleteByPattern('restaurant:*'),
    this.cacheService.deleteByPattern('category:*'),
    foodId ? this.cacheService.deleteByPattern(`food:${foodId}:*`) : Promise.resolve(0),
    restaurantId ? this.cacheService.deleteByPattern(`food:restaurant:${restaurantId}:*`) : Promise.resolve(0),
    categoryId ? this.cacheService.deleteByPattern(`food:category:${categoryId}:*`) : Promise.resolve(0),
  ]);
}
```

## 7. TTL goi y

Nen chon TTL theo muc do thay doi du lieu:

```txt
Category: 5-30 phut
Restaurant list/detail: 30-60 giay
Food list: 30-60 giay
Promotion active: 30-60 giay
Promotion all/admin: 1-5 phut
Toppings: 5 phut
Dashboard/report: 30-120 giay
External API response: 1 gio den 1 ngay
```

Trong project hien tai:

```ts
CACHE_TTL_SECONDS.SHORT = 30
CACHE_TTL_SECONDS.MEDIUM = 60
CACHE_TTL_SECONDS.LONG = 300
CACHE_TTL_SECONDS.VERY_LONG = 1800
```

Khi luu cache, `AppCacheService` tu cong them random jitter duoi 30 giay vao TTL.
Vi du TTL 60s se duoc luu thanh 60-89s. Cach nay giup cac key khong het han cung luc va giam nguy co nhieu request dong thoi query DB.

## 8. Nen cache API nao?

Nen cache:

- API GET doc nhieu.
- Query co pagination.
- Query join nhieu bang.
- Du lieu it thay doi.
- External API response nhu Mapbox/geocoding.

Vi du:

- `GET /categories`
- `GET /restaurants`
- `GET /foods`
- `GET /promotions/active`
- `GET /foods/restaurant/:restaurantId`

Khong nen cache:

- Login/register.
- Payment callback.
- Checkout/order mutation.
- API realtime shipper/order status.
- API tra du lieu rieng tu user neu chua dua `userId` vao cache key.

## 9. Quy tac dat cache key

Dung namespace ro rang:

```txt
category:findAll
category:findOne
promotion:active
restaurant:findAll
food:byRestaurant
```

Moi tham so anh huong response phai nam trong key:

```ts
buildCacheKey('food:findAll', {
  page,
  pageSize,
  lat,
  lng,
  status,
  sortBy,
});
```

Neu thieu param trong key, co the bi tra nham cache.

Vi du sai:

```ts
buildCacheKey('food:findAll', { page, pageSize });
```

Neu API co `status=available` va `status=hidden`, key tren se lam 2 response de len nhau.

## 10. Checklist khi them cache cho API moi

1. Xac dinh API co nen cache khong.
2. Kiem tra response co phu thuoc `userId`, role, query params, location khong.
3. Tao key bang `buildCacheKey(...)`.
4. Boc query DB bang `cacheService.remember(...)`.
5. Chon TTL phu hop.
6. Tim tat ca mutation co the lam response do thay doi.
7. Them invalidate bang `deleteByPattern(...)`.
8. Chay:

```bash
npx tsc --noEmit
npm run build
docker compose config
```

## 11. Lenh kiem tra Redis local

Start docker:

```bash
docker compose up -d redis
```

Kiem tra Redis song:

```bash
docker exec -it fooddie_redis redis-cli ping
```

Xem key:

```bash
docker exec -it fooddie_redis redis-cli keys '*'
```

Xoa tat ca cache local:

```bash
docker exec -it fooddie_redis redis-cli flushdb
```

Trong production, han che dung `KEYS *` va `FLUSHDB`; nen dung `SCAN` hoac helper `deleteByPattern`.

## 12. Ghi nho production

- Khong cache du lieu user-sensitive neu key khong co `userId`/role.
- Khong cache response mutation.
- Khong dung TTL qua dai cho du lieu gia, promotion, trang thai mon.
- Luon invalidate sau khi DB write thanh cong.
- Neu Redis loi, service hien tai se log warning va fallback query DB, khong lam API chet vi cache.
- Neu co nhieu instance backend, Redis giup share cache giua cac instance. In-memory cache khong lam duoc dieu nay.
