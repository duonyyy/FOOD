# `GeocodingService`

File code: `src/services/geocoding.service.ts`

Service nay chuyen dia chi dang chu thanh toa do dia ly.

## Muc dich nghiep vu

Khi tao hoac cap nhat nha hang, frontend co the chi gui dia chi ma chua gui `latitude/longitude`. Backend can toa do de sau nay tinh khoang cach giao hang, vi vay service nay goi Mapbox Geocoding API de lay toa do.

## Input

Ham chinh:

```ts
geocode(addressParts: {
  street: string;
  ward: string;
  district: string;
  city: string;
})
```

Service ghep cac phan nay thanh dia chi day du:

```text
street, ward, district, city, Vietnam
```

Sau do encode dia chi va gui len Mapbox.

## Output

Neu Mapbox tra ve ket qua hop le:

```ts
{
  lat: number;
  lng: number;
}
```

Neu khong co token, API loi, hoac Mapbox khong tim thay dia chi:

```ts
null
```

## Phu thuoc

- `axios`
- bien moi truong `MAPBOX_ACCESS_TOKEN`
- Mapbox Geocoding API endpoint:

```text
https://api.mapbox.com/geocoding/v5/mapbox.places
```

## Rule quan trong

Service gioi han ket qua ve Viet Nam:

```ts
country: 'vn'
```

Va chi lay ket qua dau tien:

```ts
limit: 1
```

Dieu nay giup he thong co ket qua nhanh, nhung neu dia chi mo ho thi co the lay sai diem gan dung.

## Xu ly loi

Neu khong co `MAPBOX_ACCESS_TOKEN`, service khong throw loi. No chi log warning va tra `null`.

Ly do: geocoding thuong la tinh nang ho tro. He thong van co the luu dia chi text, chi la chua co toa do de tinh khoang cach chinh xac.

## Ham `haversineDistance`

Ngoai geocoding, service co ham:

```ts
haversineDistance(lat1, lon1, lat2, lon2)
```

Ham nay tinh khoang cach duong chim bay giua 2 toa do, don vi la kilomet.

Khac voi Mapbox Directions:

- haversine: khoang cach thang tren trai dat
- directions: khoang cach theo duong di thuc te

## Noi dang dung

Hien tai `RestaurantService` dung service nay khi tao/cap nhat nha hang.

Flow rut gon:

```text
RestaurantService
  -> neu address chua co latitude/longitude
  -> GeocodingService.geocode(address)
  -> luu toa do vao Address neu co ket qua
```

## Loi de nham

Mapbox tra toa do theo thu tu:

```text
[longitude, latitude]
```

Nhung backend tra ra object:

```ts
{ lat: latitude, lng: longitude }
```

Khi sua code, phai can than khong dao nguoc `lat` va `lng`.

