# Ghi chu bao tri va refactor

File nay ghi lai cac diem can chu y khi sua code trong `src/services`.

## 1. Can than thu tu toa do

Mapbox dung:

```ts
[lng, lat]
```

Nhieu entity/business code dung:

```ts
latitude, longitude
// hoac
lat, lng
```

Neu route sai bat thuong, hay kiem tra dau tien xem co bi dao nguoc toa do khong.

## 2. `MapboxService` va function export dang song song

Trong `mapbox.service.ts` co ca:

- class `MapboxService`
- function export `getDistanceAndDurationFromMapbox(...)`

Function export hien duoc `FoodService` import truc tiep.

Huong refactor tot hon:

```text
FoodService inject MapboxService
  -> goi this.mapboxService.getDistanceAndDurationFromMapbox(...)
```

Loi ich:

- dung dung dependency injection cua NestJS
- de test mock service hon
- tranh tao instance moi va doc env rieng le

## 3. Nen co module shared cho services dung chung

Hien tai cac module tu khai bao provider:

- `OrderModule`
- `ChatModule`
- `PaymentModule`
- `RestaurantModule`

Huong refactor:

```text
ServicesModule
  providers: [GeocodingService, MapboxService, SystemConstraintsService]
  exports: [GeocodingService, MapboxService, SystemConstraintsService]
```

Sau do module nao can thi import `ServicesModule`.

## 4. `system_constraints` ngam dinh chi co 1 record

`SystemConstraintsService` dang dung:

```ts
findOne({ where: {} })
```

Nghia la lay mot record bat ky.

Neu sau nay can nhieu cau hinh theo khu vuc, theo loai nha hang, theo khung gio, nen them field ro rang nhu:

- `scope`
- `is_active`
- `city`
- `effective_from`
- `effective_to`

Con neu van chi co 1 cau hinh toan he thong, nen dam bao bang nay chi co 1 record bang constraint hoac seed logic.

## 5. Default values dang lap lai

Default constraints xuat hien o nhieu noi:

- entity default column
- `createDefaultConstraints`
- `getHardcodedDefaults`
- fallback trong mot so method

Neu sau nay doi phi ship hay limit, can kiem tra tat ca cac noi tren.

Huong refactor:

```ts
const DEFAULT_SYSTEM_CONSTRAINTS = { ... }
```

Sau do entity, create default, hardcoded fallback cung tham chieu chung mot object.

## 6. Loi Mapbox nen duoc quan sat ky

`MapboxService` co fallback haversine nen he thong co the van chay khi Mapbox loi.

Nhung fallback la uoc luong, khong phai duong di thuc te. Neu Mapbox loi thuong xuyen, phi ship va ETA co the kem chinh xac.

Nen theo doi log:

```text
Mapbox failed, using haversine fallback
```

## 7. Nen test cac case nghiep vu quan trong

Cac case nen co unit test:

- tinh phi ship theo 3 tier
- distance vuot max delivery distance
- shipper khong active
- shipper sai role
- shipper qua nhieu active deliveries
- completion rate duoi nguong
- database loi nhung co cache
- database loi va khong co cache
- Mapbox loi thi fallback haversine

