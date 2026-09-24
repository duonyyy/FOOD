# Users / Identity

Users sở hữu `User`, `Role`, `Permission`; entity vẫn nằm ở `src/entities`. Auth sở hữu đăng nhập,
JWT và guard. Controller Users giữ nguyên các route `/users` và `/role`; Auth giữ `/auth`.

Mã nghiệp vụ được nhóm theo hai vùng:

```text
users/
  contracts/ controllers/ dto/ mappers/ services/ types/
roles/
  controllers/ dto/ mappers/ services/
```

`users/` chứa actor contract và luồng tài khoản/hồ sơ/query User. `roles/` chứa controller,
DTO, mapper và service cho Role/Permission. Các module ghép feature, public API và README ở
thư mục gốc vì chúng là điểm composition của toàn bộ Users.

| Provider | Module đăng ký | Consumer chính |
| --- | --- | --- |
| `UsersService` | `UsersModule` | Auth, Auth guard, Delivery shipper profile |
| `RolesService` | `UsersModule` | Auth, role commands |
| `IdentityUserQueryService` | `IdentityModule` | Users reads, Orders, Delivery, Restaurants, Messenger |
| `IdentityRoleQueryService` | `IdentityModule` | role/permission reads |
| `UserProfileService` | `IdentityModule` | current-user/admin profile update; Locations address writer |
| `AdminUsersService` | `IdentityModule` | admin create/delete user |
| `IdentityUserProfileService` | `IdentityUserProfileModule` | Delivery shipper profile |
| `AuthGuard`, `RolesGuard` | `AuthModule` | protected controllers across features |

`IdentityModule` đăng ký controller/query provider User và Role cùng service ghi hồ sơ/quản trị, nhập `AuthModule` để dùng
guard, và chỉ export `IdentityUserQueryService` cho consumer. Nó không export lại Auth.
Các module chỉ cần guard nhập `AuthModule` trực tiếp. `UsersModule` đăng ký `UsersService` và
`RolesService` một lần cho Auth/Identity; `IdentityUserProfileModule` phục vụ Delivery mà không
kéo Auth vào.

Luồng phụ thuộc: `IdentityModule -> AuthModule -> ShipperProfileModule ->
IdentityUserProfileModule/UsersModule`; `IdentityModule -> UsersModule`. Delivery chính nhập cả
`AuthModule` và `IdentityModule`, còn hồ sơ shipper chỉ nhập các module Users hẹp. Gộp mọi
module Users vào `IdentityModule` sẽ tạo vòng `Auth -> Delivery profile -> Identity -> Auth`.

Users hiện giữ ba public API: `public-api.ts` cho Identity/actor/read, `identity-auth.public-api.ts`
cho service và module Auth/Delivery dùng, và `identity-user-profile.public-api.ts` cho Delivery
profile. Hai public API của Auth tách
module runtime với guard/contract để tránh vòng nạp module. Guard phải import từ
`src/features/auth/public-api`, không từ Users.

`UserProfileService.update` vẫn gọi Locations để ghi địa chỉ cho route self và admin; đăng ký shipper đi qua Delivery
profile và dùng cùng transaction manager với account. Các route/DTO/response này chưa đổi.

Controller User phân theo actor: `CurrentUserController` và `CurrentUserQueryController` sở hữu
`PUT/GET /users/me`; `AdminUsersController` và `AdminUserQueryController` sở hữu các route
`/users` còn lại. Role command/query vẫn ở hai controller vì các route đều phục vụ quản trị,
ngoại trừ truy vấn role của chính người dùng ở cổng admin. Service query dùng chung cho các
controller; không tạo lớp chuyển tiếp chỉ để đổi tên.
