# Cac flow nghiep vu lien quan

File nay giai thich cac luong chinh dang dung service trong `src/services`.

## Flow 1: Tao/cap nhat nha hang va lay toa do

Dung service:

- `GeocodingService`

Flow:

```text
Client gui thong tin nha hang
  -> RestaurantService
  -> kiem tra du lieu dia chi
  -> neu address da co latitude/longitude:
       dung toa do frontend gui
     neu chua co latitude/longitude:
       goi GeocodingService.geocode(...)
       -> Mapbox Geocoding API
       -> nhan { lat, lng } hoac null
  -> luu Address
  -> luu Restaurant
  -> tra ket qua ve client
```

Y nghia:

- Toa do giup cac flow sau tinh khoang cach giao hang.
- Neu geocoding fail, he thong co the van luu dia chi text.
- Don hang sau nay co the khong tinh duoc route neu nha hang thieu toa do.

## Flow 2: Tao order va tinh phi giao hang

Dung service:

- `MapboxService`
- `SystemConstraintsService`

Flow:

```text
Client tao order
  -> OrderService.createOrder(...)
  -> lay restaurant va delivery address
  -> kiem tra ca 2 diem co latitude/longitude
  -> MapboxService.calculateBikeRoute(...)
       -> Mapbox Directions API
       -> neu loi thi fallback haversine
  -> lay deliveryDistance va estimatedDuration
  -> SystemConstraintsService.isDistanceWithinLimits(distance)
       -> neu qua xa: chan order
  -> SystemConstraintsService.calculateShippingFee(distance)
  -> tinh subtotal, discount, total
  -> tao Order va OrderDetail
  -> tra order ve client
```

Y nghia:

- `MapboxService` tra ve du lieu thuc te ve duong di.
- `SystemConstraintsService` quyet dinh don co hop le khong va phi ship bao nhieu.
- Neu distance vuot `max_delivery_distance`, order bi tu choi.

## Flow 3: Tim mon an gan nguoi dung

Dung service/function:

- `getDistanceAndDurationFromMapbox(...)` export tu `mapbox.service.ts`

Flow:

```text
Client tim mon + gui toa do hien tai
  -> FoodService.findByName(...)
  -> query danh sach food + restaurant
  -> voi tung restaurant co toa do:
       goi getDistanceAndDurationFromMapbox(userLocation, restaurantLocation)
  -> gan distance va deliveryTime vao ket qua
  -> loc theo radius neu co
  -> sort theo khoang cach
  -> tra danh sach food
```

Y nghia:

- Client co the hien thi mon nao gan hon.
- Nguoi dung thay duoc uoc luong giao hang.
- Hien tai flow nay chua inject `MapboxService`, ma import function truc tiep.

## Flow 4: Xet shipper co du dieu kien nhan don

Dung service:

- `SystemConstraintsService`

Flow:

```text
OrderResolver / logic phan cong shipper
  -> lay danh sach shipper ung vien
  -> voi tung shipper:
       SystemConstraintsService.isShipperEligible(shipper)
  -> loai shipper khong dat
  -> dung score/reasons de quyet dinh tiep
```

Service se kiem tra:

- user co phai shipper khong
- account co active khong
- certificate co approved khong
- completion rate
- so don dang giao
- rating
- lich su giao dung gio
- thoi gian phan hoi
- ti le tu choi don

Output:

```ts
{
  eligible: true,
  reasons: [],
  score: 132.5
}
```

Hoac:

```ts
{
  eligible: false,
  reasons: ['Too many active deliveries: 3/3'],
  score: 65
}
```

## Flow 5: Cap nhat constraints tu admin

Dung service:

- `SystemConstraintsService`

Flow:

```text
Admin cap nhat cau hinh
  -> updateConstraints(updates)
  -> tim record system_constraints hien tai
  -> neu chua co thi tao default
  -> Object.assign constraints voi updates
  -> save database
  -> clear cache
  -> lan goi tiep theo se doc lai DB
```

Y nghia:

- Co the doi rule giao hang ma khong can sua code.
- Clear cache giup thay doi co hieu luc sau khi update.

