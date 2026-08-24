# `MapboxService`

File code: `src/services/mapbox.service.ts`

Service nay tinh quang duong va thoi gian di chuyen giua 2 toa do bang Mapbox Directions API.

## Muc dich nghiep vu

He thong can biet nha hang cach khach bao xa va giao mat bao lau de:

- kiem tra don co nam trong pham vi giao hang khong
- tinh phi ship
- hien thi khoang cach/thoi gian tren man hinh tim kiem mon
- ho tro phan cong shipper

## Phu thuoc

- `@mapbox/mapbox-sdk/services/directions`
- bien moi truong `MAPBOX_ACCESS_TOKEN`

Khac voi `GeocodingService`, neu thieu token thi constructor cua `MapboxService` throw loi:

```text
MAPBOX_ACCESS_TOKEN is missing in .env
```

## Ham cap thap: `getDistanceAndDurationFromMapbox`

```ts
getDistanceAndDurationFromMapbox(
  origin: [number, number],
  destination: [number, number]
)
```

Input phai theo thu tu Mapbox:

```text
[lng, lat]
```

Output:

```ts
{
  distanceKm: number;
  durationMin: number;
} | null
```

Service goi Directions API voi profile:

```ts
profile: 'driving'
```

Trong code co comment day la lua chon gan dung cho giao hang bang xe may/scooter.

## Ham cap nghiep vu: `calculateBikeRoute`

```ts
calculateBikeRoute(fromLat, fromLng, toLat, toLng)
```

Ham nay de dung trong business logic vi thu tu tham so de doc hon.

Output:

```ts
{
  distance: number; // kilomet
  duration: number; // giay
  route: any;
}
```

Luu y:

- `getDistanceAndDurationFromMapbox` tra duration theo phut.
- `calculateBikeRoute` doi duration sang giay.

## Fallback khi Mapbox loi

Neu Directions API khong tra route hoac bi loi, service dung cong thuc haversine.

Fallback distance:

```text
khoang cach duong chim bay
```

Fallback duration:

```text
distanceKm * 180 giay
```

Nghia la uoc luong 1km mat khoang 3 phut.

## Tinh nhieu route

Ham:

```ts
calculateMultipleRoutes(from, destinations)
```

Dung de tinh tu mot diem goc den nhieu diem den.

Input:

```ts
from: { lat: number; lng: number }
destinations: Array<{ lat: number; lng: number; id: string }>
```

Output:

```ts
Array<{ id: string; distance: number; duration: number }>
```

Ham nay hien dang xu ly lan luot tung destination, chua toi uu bang batch API.

## Function export rieng

Cuoi file co function:

```ts
export async function getDistanceAndDurationFromMapbox(...)
```

Function nay tao instance `MapboxService` moi va goi method ben trong class.

Muc dich hien tai: giu tuong thich voi code cu trong `FoodService`.

Ve lau dai nen can nhac refactor `FoodService` sang inject `MapboxService` thay vi import function truc tiep.

## Noi dang dung

- `OrderService`: tinh route khi tao order, tinh phi ship, kiem tra gioi han khoang cach.
- `FoodService`: tinh distance/duration khi tim mon theo vi tri nguoi dung.
- `OrderModule`, `ChatModule`, `PaymentModule`: dang khai bao provider `MapboxService`.

## Loi de nham

Loi pho bien nhat la dao nguoc toa do.

Dung voi Mapbox:

```ts
[lng, lat]
```

Dung trong business code:

```ts
fromLat, fromLng, toLat, toLng
```

Neu dao nguoc, route co the sai rat xa hoac Mapbox khong tim thay duong.

