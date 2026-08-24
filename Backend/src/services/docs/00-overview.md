# Tong quan nghiep vu trong `src/services`

Thu muc nay gom cac service dung chung cho nhieu module. Chuc nang chinh xoay quanh bai toan giao do an:

1. Lay toa do tu dia chi.
2. Tinh quang duong va thoi gian giao hang.
3. Ap dung cac rule he thong de quyet dinh phi ship, gioi han giao hang, va shipper co du dieu kien nhan don hay khong.

## Vi tri trong he thong

```text
Client
  -> module nghiep vu: restaurant / food / order / chat / payment
  -> src/services
  -> Mapbox API hoac database
```

`src/services` khong xu ly truc tiep request tu client. Cac controller, resolver, service domain se goi vao day khi can logic dung chung.

## 3 service chinh

### `GeocodingService`

Dung khi he thong co dia chi dang text nhung chua co toa do.

Vi du:

```text
"123 Nguyen Trai, Phuong Ben Thanh, Quan 1, Ho Chi Minh"
  -> GeocodingService
  -> Mapbox Geocoding API
  -> { lat, lng }
```

Toa do nay sau do duoc luu vao `Address` hoac dung cho cac flow tinh khoang cach.

### `MapboxService`

Dung khi he thong da co 2 toa do va can tinh duong di giao hang.

Vi du:

```text
Restaurant lat/lng + Customer lat/lng
  -> MapboxService.calculateBikeRoute(...)
  -> distance + duration
```

Ket qua duoc dung de:

- chan don neu qua xa
- tinh phi giao hang
- hien thi thoi gian giao du kien
- sap xep ket qua tim kiem theo khoang cach

### `SystemConstraintsService`

Dung khi can doc cac cau hinh/rang buoc giao hang tu database.

Vi du:

- toi da giao trong `30km`
- phi ship `0-5km = 15000`
- shipper phai co rating toi thieu `3.5`
- shipper khong duoc co qua `3` don dang giao

Service nay co cache 5 phut de tranh query database qua nhieu.

## Dieu can nho

- `Mapbox` dung thu tu toa do `[lng, lat]`.
- Code business trong cac module thuong dung thu tu de doc hon: `lat, lng`.
- `SystemConstraintsService` co fallback nhieu tang: cache, default trong DB, hardcoded default.
- `MapboxService` co fallback sang haversine neu Directions API loi.

