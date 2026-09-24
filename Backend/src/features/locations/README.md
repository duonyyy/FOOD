# Locations

Locations sở hữu `Address`, tọa độ, địa chỉ tạm và address snapshot. Entity tiếp tục nằm tại
`src/entities`. Callers dùng `AddressService` qua public API của Locations.

`LocationsModule` đăng ký controller HTTP, repository `Address` và duy nhất một provider
`AddressService`; module này export service cho Users, Orders, Restaurants và Communications.
`public-api.ts` là điểm import duy nhất cho feature khác. Identity import `LocationsModule`
để dùng `AddressService`, nên cả controller địa chỉ cũng nằm trong cây module của Identity.
Mapping response nằm ngay trong `AddressService`; không còn mapper file riêng.
