# `SystemConstraintsService`

File code: `src/services/system-constraints.service.ts`

Service nay gom cac rule cau hinh cua he thong giao hang.

## Muc dich nghiep vu

Thay vi hardcode cac nguong nhu phi ship, khoang cach giao toi da, rating toi thieu cua shipper trong nhieu file, service nay gom ve mot noi.

Nhom rule chinh:

- gioi han giao hang
- tinh phi ship
- danh gia shipper co du dieu kien nhan don hay khong
- tinh tien shipper nhan duoc
- cap nhat constraint cho admin

## Entity lien quan

Entity:

```text
src/entities/systemConstaints.entity.ts
```

Bang database:

```text
system_constraints
```

Ten file co chu `Constaints` bi sai chinh ta so voi `Constraints`, nhung day la ten dang ton tai trong code nen chua nen doi neu khong refactor dong bo.

## Cac truong cau hinh

| Field | Y nghia | Default |
| --- | --- | --- |
| `min_completion_rate` | Ty le hoan thanh don toi thieu cua shipper | `0.7` |
| `min_total_orders` | So don toi thieu de bat dau xet completion rate | `10` |
| `max_active_deliveries` | So don dang giao toi da cua mot shipper | `3` |
| `max_delivery_distance` | Khoang cach giao toi da, don vi km | `30` |
| `min_shipper_rating` | Rating toi thieu cua shipper | `3.5` |
| `max_delivery_time_min` | Thoi gian giao toi da, don vi phut | `45` |
| `base_distance_km` | Moc km cho tier phi dau tien | `5` |
| `base_shipping_fee` | Phi ship tier 1 | `15000` |
| `tier2_distance_km` | Moc km cho tier phi thu hai | `10` |
| `tier2_shipping_fee` | Phi ship tier 2 | `25000` |
| `tier3_shipping_fee` | Phi ship tier 3 | `35000` |

## Cache

Service cache constraint trong memory:

```text
5 phut
```

Flow doc constraint:

```text
getConstraints()
  -> neu cache con han: tra cache
  -> neu cache het han: doc database
  -> neu database chua co record: tao default constraints
  -> neu database loi: dung cache neu co
  -> neu khong co cache: dung hardcoded default
```

Khi goi `updateConstraints(...)`, service luu thay doi vao DB va clear cache.

## Kiem tra shipper co du dieu kien khong

Ham:

```ts
isShipperEligible(shipper)
```

Output:

```ts
{
  eligible: boolean;
  reasons: string[];
  score: number;
}
```

Service kiem tra theo thu tu:

1. Co du lieu shipper khong.
2. User co role `shipper` khong.
3. Account co active khong.
4. Certificate co approved khong.
5. Completion rate co dat nguong khong.
6. So don dang giao co vuot muc toi da khong.
7. Rating co dat nguong khong.
8. Diem cong/tru theo performance.

Neu fail cac dieu kien bat buoc nhu role, active, certificate, service tra ve ngay `eligible: false`.

Neu fail cac chi so mem nhu completion rate, active deliveries, rating, service them ly do vao `reasons` va tru diem.

## Cach tinh score shipper

Score bat dau tu:

```text
100
```

Sau do cong/tru theo:

- completion rate
- so don dang giao
- rating
- so don da hoan thanh
- hoat dong gan day
- ti le giao dung gio
- thoi gian phan hoi
- ti le tu choi don

Shipper du dieu kien khi:

```text
reasons rong va score >= 30
```

## Tinh phi ship

Ham:

```ts
calculateShippingFee(distanceKm)
```

Rule mac dinh:

```text
0-5km: 15000
5-10km: 25000
10km+: 35000
```

Thuc te cac moc va phi lay tu `SystemConstraint`, khong phai luc nao cung dung default.

## Kiem tra gioi han khoang cach

Ham:

```ts
isDistanceWithinLimits(distanceKm)
```

Mac dinh:

```text
distanceKm <= 30
```

Neu database loi thi fallback ve `30km`.

## Thu nhap shipper

Ham:

```ts
calculateShipperEarnings(shippingFee)
```

Hien tai commission rate mac dinh la:

```text
80%
```

Vi du:

```text
shippingFee = 25000
shipperEarnings = 20000
platformFee = 5000
```

## Noi dang dung

- `OrderService`: check khoang cach, tinh phi ship, lay max delivery time.
- `OrderResolver`: check shipper eligibility khi phan cong shipper.
- `OrderModule`, `ChatModule`, `PaymentModule`: khai bao provider.

## Diem can can than

Service nay dang lay ban ghi dau tien trong bang `system_constraints` bang `findOne({ where: {} })`.

Y nghia ngam dinh:

```text
toan he thong chi nen co 1 record constraints
```

Neu database co nhieu record, ket qua co the khong ro rang. Ve sau nen them rule ro hon, vi du chi dung record active, hoac sap xep theo `updated_at`.

