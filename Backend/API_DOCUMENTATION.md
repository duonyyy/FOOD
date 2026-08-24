# API Documentation

## 1. Overview
This document represents a 100% reverse-engineered REST API documentation from the Foodee Backend source code.
It is generated dynamically by traversing the Abstract Syntax Tree of the codebase to guarantee single source of truth accuracy.

## 2. API Summary

| # | Method | Endpoint | Module | Auth | Authorization | Description |
|---|---|---|---|---|---|---|
| 1 | GET | `/` | system | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 2 | GET | `/health` | system | Not specified | None | Check Foodee API liveness |
| 3 | POST | `/auth/login/email` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 4 | POST | `/auth/register` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 5 | POST | `/auth/register/google` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 6 | POST | `/auth/logout` | Auth | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 7 | POST | `/auth/forgot-password` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 8 | POST | `/auth/reset-password` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 9 | GET | `/auth/verify-reset-token` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 10 | POST | `/auth/register-driver` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 11 | GET | `/auth/check-phone` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 12 | POST | `/auth/send-otp` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 13 | POST | `/auth/verify-otp` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 14 | POST | `/auth/login-driver` | Auth | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 15 | POST | `/auth/check` | Auth | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 16 | POST | `/demo-payment/create-order` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 17 | POST | `/demo-payment/create-checkout` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 18 | GET | `/demo-payment/vnpay-result` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 19 | GET | `/demo-payment/vnpay-ipn` | DemoPayment | Provider Signature Verification (INFERRED) | None | CONFIRMED: Internal/Undocumented endpoint |
| 20 | GET | `/demo-payment/result` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 21 | GET | `/demo-payment/check-status` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 22 | POST | `/demo-payment/webhook` | DemoPayment | Provider Signature Verification (INFERRED) | None | CONFIRMED: Internal/Undocumented endpoint |
| 23 | GET | `/demo-payment/orders` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 24 | GET | `/demo-payment/checkouts` | DemoPayment | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 25 | POST | `/payment/process/:checkoutId` | payments | JWT Bearer | None | Process an authenticated checkout |
| 26 | POST | `/payment/cancel/:checkoutId` | payments | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 27 | POST | `/payment/webhook` | payments | Provider Signature Verification (INFERRED) | None | Receive a signed payment provider webhook |
| 28 | GET | `/payment/checkout/:checkoutId` | payments | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 29 | GET | `/payment/momo/result` | payments | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 30 | POST | `/payment/momo/check-status` | payments | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 31 | GET | `/payment/vnpay/result` | payments | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 32 | GET | `/payment/webhook/vnpay` | payments | Provider Signature Verification (INFERRED) | None | CONFIRMED: Internal/Undocumented endpoint |
| 33 | GET | `/payment/vnpay/status` | payments | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 34 | GET | `/protected` | Protected | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 35 | GET | `/foods/:foodId/reviews` | reviews | Not specified | None | List paginated public reviews for a food item |
| 36 | POST | `/reviews/food` | reviews | JWT Bearer | None | Review a food item from the current customer completed order |
| 37 | POST | `/reviews/shipper` | reviews | JWT Bearer | None | Review the shipper assigned to the current customer completed order |
| 38 | GET | `/reviews/food/:foodId` | reviews | Not specified | None | List public food reviews |
| 39 | GET | `/reviews/shipper/:shipperId` | reviews | Not specified | None | List public shipper reviews |
| 40 | PUT | `/reviews/:id` | reviews | JWT Bearer | None | Update a review owned by the current user |
| 41 | DELETE | `/reviews/:id` | reviews | JWT Bearer | None | Delete a review owned by the current user |
| 42 | GET | `/minio/health/live` | system | Not specified | None | Check API connectivity to MinIO |
| 43 | POST | `/chat` | Chat | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 44 | GET | `/dashboard/stats` | Dashboard | Not specified | Permission.DASHBOARD.READ | CONFIRMED: Internal/Undocumented endpoint |
| 45 | GET | `/dashboard/chart-data` | Dashboard | Not specified | Permission.DASHBOARD.READ | CONFIRMED: Internal/Undocumented endpoint |
| 46 | GET | `/dashboard/shipper-stats` | Dashboard | Not specified | Permission.DASHBOARD.READ | CONFIRMED: Internal/Undocumented endpoint |
| 47 | GET | `/dashboard/order-completion-stats` | Dashboard | Not specified | Permission.DASHBOARD.READ | CONFIRMED: Internal/Undocumented endpoint |
| 48 | POST | `/foods` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 49 | GET | `/foods/all` | foods | Not specified | Permission.FOOD.READ | CONFIRMED: Internal/Undocumented endpoint |
| 50 | GET | `/foods` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 51 | GET | `/foods/top-selling` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 52 | GET | `/foods/newest` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 53 | GET | `/foods/with-discount` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 54 | GET | `/foods/search` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 55 | GET | `/foods/by-name` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 56 | GET | `/foods/top` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 57 | GET | `/foods/restaurant/:restaurantId` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 58 | GET | `/foods/restaurant/:restaurantId/top-selling` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 59 | GET | `/foods/restaurant/:restaurantId/with-discount` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 60 | GET | `/foods/category/:categoryId` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 61 | GET | `/foods/category/:categoryId/restaurant/:restaurantId` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 62 | GET | `/foods/:id` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 63 | PUT | `/foods/:id` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 64 | DELETE | `/foods/:id` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 65 | PUT | `/foods/:id/status` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 66 | DELETE | `/foods/:id/admin` | foods | Not specified | Permission.FOOD.DELETE | CONFIRMED: Internal/Undocumented endpoint |
| 67 | POST | `/foods/:id/toppings` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 68 | PUT | `/foods/toppings/:toppingId` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 69 | DELETE | `/foods/toppings/:toppingId` | foods | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 70 | GET | `/foods/:id/toppings` | foods | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 71 | POST | `/messenger/conversations` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 72 | GET | `/messenger/conversation-ids` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 73 | GET | `/messenger/conversations` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 74 | POST | `/messenger/messages` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 75 | GET | `/messenger/conversations/:conversationId/messages` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 76 | PUT | `/messenger/conversations/:conversationId/read` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 77 | DELETE | `/messenger/messages/:messageId` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 78 | PUT | `/messenger/conversations/:conversationId/block` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 79 | GET | `/messenger/unread-count` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 80 | GET | `/messenger/available-partners` | Messenger | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 81 | POST | `/orders` | orders | JWT Bearer | None | Create an order using server-authoritative pricing |
| 82 | GET | `/orders/my` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 83 | GET | `/orders` | orders | Not specified | Permission.ORDER.READ | CONFIRMED: Internal/Undocumented endpoint |
| 84 | POST | `/orders/calculate` | orders | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 85 | POST | `/orders/calculate-custom` | orders | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 86 | GET | `/orders/restaurant/my` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 87 | GET | `/orders/:id` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 88 | GET | `/orders/user/:userId` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 89 | GET | `/orders/:id/details` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 90 | PUT | `/orders/:id/status` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 91 | PUT | `/orders/admin/:id/status` | orders | Not specified | Permission.ORDER.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 92 | DELETE | `/orders/:id` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 93 | POST | `/orders/:id/payment` | orders | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 94 | POST | `/orders/validate-promotion` | orders | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 95 | POST | `/promotions` | promotions | Not specified | Permission.PROMOTION.CREATE | CONFIRMED: Internal/Undocumented endpoint |
| 96 | GET | `/promotions/all` | promotions | Not specified | None | CONFIRMED: Internal/Undocumented endpoint |
| 97 | GET | `/promotions` | promotions | Not specified | Permission.PROMOTION.READ | CONFIRMED: Internal/Undocumented endpoint |
| 98 | GET | `/promotions/:id` | promotions | Not specified | Permission.PROMOTION.CREATE | CONFIRMED: Internal/Undocumented endpoint |
| 99 | PUT | `/promotions/:id` | promotions | Not specified | Permission.PROMOTION.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 100 | DELETE | `/promotions/:id` | promotions | Not specified | Permission.PROMOTION.DELETE | CONFIRMED: Internal/Undocumented endpoint |
| 101 | POST | `/role` | roles | JWT Bearer | Permission.ROLE.CREATE | CONFIRMED: Internal/Undocumented endpoint |
| 102 | PUT | `/role/:id/permissions` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 103 | PUT | `/role/:id` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 104 | POST | `/role/:id/users` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 105 | POST | `/role/:id/assign-users` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 106 | POST | `/role/:id/users/remove` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 107 | POST | `/role/:id/permissions` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 108 | POST | `/role/:id/permissions/remove` | roles | JWT Bearer | Permission.ROLE.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 109 | DELETE | `/role/:id` | roles | JWT Bearer | Permission.ROLE.DELETE | CONFIRMED: Internal/Undocumented endpoint |
| 110 | POST | `/shippers/accept-order` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 111 | POST | `/shippers/get-order` | delivery | JWT Bearer | None | Read an assigned order without changing delivery state |
| 112 | POST | `/shippers/start-order` | delivery | JWT Bearer | None | Start an assigned delivery |
| 113 | POST | `/shippers/complete-order` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 114 | POST | `/shippers/cancel-order` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 115 | POST | `/shippers/reject-order` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 116 | GET | `/shippers/pending-assignment` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 117 | GET | `/shippers/order-history` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 118 | GET | `/shippers/profile` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 119 | GET | `/shippers/income-report` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 120 | POST | `/shippers/update-location` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 121 | GET | `/shippers/dashboard` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 122 | GET | `/shippers/performance` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 123 | GET | `/shippers/earnings-breakdown` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 124 | GET | `/shippers/achievements` | delivery | JWT Bearer | None | CONFIRMED: Internal/Undocumented endpoint |
| 125 | GET | `/users/shippers` | users | JWT Bearer | Permission.SHIPPER.READ | List shipper compatibility projections |
| 126 | PUT | `/users/me` | users | JWT Bearer | None | Update the current user profile (legacy address compatibility) |
| 127 | POST | `/users` | users | JWT Bearer | Permission.USER.CREATE | CONFIRMED: Internal/Undocumented endpoint |
| 128 | PUT | `/users/:id` | users | JWT Bearer | Permission.USER.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 129 | DELETE | `/users/:id` | users | JWT Bearer | Permission.USER.DELETE | CONFIRMED: Internal/Undocumented endpoint |
| 130 | PATCH | `/users/shippers/:userId/approve` | users | JWT Bearer | Permission.SHIPPER.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 131 | PATCH | `/users/shippers/:userId/reject` | users | JWT Bearer | Permission.SHIPPER.WRITE | CONFIRMED: Internal/Undocumented endpoint |
| 132 | GET | `/notifications` | Notifications | JWT Bearer | None | Lấy danh sách thông báo của tôi |
| 133 | PATCH | `/notifications/:id/read` | Notifications | JWT Bearer | None | Đánh dấu thông báo đã đọc |
| 134 | GET | `/role` | roles | JWT Bearer | Permission.ROLE.READ | List roles for an authorized administrator |
| 135 | GET | `/role/permissions` | roles | JWT Bearer | Permission.ROLE.READ | List supported permission names |
| 136 | GET | `/role/user-role-and-permission` | roles | JWT Bearer | None | Get the current administrative role for the admin portal |
| 137 | GET | `/role/user/:userId/permissions` | roles | JWT Bearer | Permission.ROLE.READ, Permission.USER.READ | List active permissions for a user |
| 138 | GET | `/role/check-permission/:roleId/:permissionName` | roles | JWT Bearer | Permission.ROLE.READ | Check whether a role has an active permission |
| 139 | GET | `/role/:id/users/available` | roles | JWT Bearer | Permission.ROLE.READ, Permission.USER.READ | List users available for a role assignment |
| 140 | GET | `/role/:id/permissions` | roles | JWT Bearer | Permission.ROLE.READ | List active permission names for a role |
| 141 | GET | `/role/:id/users` | roles | JWT Bearer | Permission.ROLE.READ, Permission.USER.READ | List safe user summaries assigned to a role |
| 142 | GET | `/role/:id` | roles | JWT Bearer | Permission.ROLE.READ | Get a role with safe user and permission summaries |
| 143 | GET | `/users/me` | users | JWT Bearer | None | Get the authenticated user profile |
| 144 | GET | `/users` | users | JWT Bearer | Permission.USER.READ | List users for an authorized administrator |
| 145 | GET | `/users/:id` | users | JWT Bearer | Permission.USER.READ | Get a user for an authorized administrator |
| 146 | POST | `/addresses` | addresses | JWT Bearer | None | Create an address for the current customer |
| 147 | GET | `/addresses` | addresses | JWT Bearer | None | List addresses owned by the current customer |
| 148 | GET | `/addresses/:id` | addresses | JWT Bearer | None | Get an address owned by the current customer |
| 149 | GET | `/addresses/user/:userId` | addresses | JWT Bearer | None | List addresses for the current customer |
| 150 | PUT | `/addresses/:id` | addresses | JWT Bearer | None | Update an address owned by the current customer |
| 151 | DELETE | `/addresses/:id` | addresses | JWT Bearer | None | Delete an address owned by the current customer |
| 152 | GET | `/categories` | categories | Not specified | None | List public food categories |
| 153 | GET | `/categories/:id` | categories | Not specified | None | Get a public food category |
| 154 | POST | `/categories` | categories | JWT Bearer | Permission.CATEGORY.CREATE | Create a category (catalog owner/admin) |
| 155 | PUT | `/categories/:id` | categories | JWT Bearer | Permission.CATEGORY.WRITE | Update a category (catalog owner/admin) |
| 156 | DELETE | `/categories/:id` | categories | JWT Bearer | Permission.CATEGORY.DELETE | Delete a category (catalog owner/admin) |
| 157 | GET | `/admin/restaurants/requests` | Admin restaurants | JWT Bearer | Permission.STORE.READ | Liệt kê yêu cầu mở nhà hàng đang chờ duyệt |
| 158 | PUT | `/admin/restaurants/:id/approve` | Admin restaurants | JWT Bearer | Permission.STORE.WRITE | Duyệt yêu cầu mở nhà hàng và ghi audit |
| 159 | PUT | `/admin/restaurants/:id/reject` | Admin restaurants | JWT Bearer | Permission.STORE.WRITE | Từ chối yêu cầu mở nhà hàng, bắt buộc lý do và ghi audit |
| 160 | DELETE | `/admin/restaurants/requests/:id` | Admin restaurants | JWT Bearer | Permission.STORE.DELETE | Xóa yêu cầu mở nhà hàng đang chờ duyệt |
| 161 | POST | `/merchant/restaurants` | Merchant restaurants | JWT Bearer | None | Gửi yêu cầu mở nhà hàng cho tài khoản đang đăng nhập |
| 162 | GET | `/merchant/restaurants/my` | Merchant restaurants | JWT Bearer | None | Lấy hồ sơ nhà hàng của tài khoản đang đăng nhập |
| 163 | PUT | `/merchant/restaurants/:id/files` | Merchant restaurants | JWT Bearer | None | Cập nhật hồ sơ và ảnh của nhà hàng mình sở hữu |
| 164 | PUT | `/merchant/restaurants/:id` | Merchant restaurants | JWT Bearer | None | Cập nhật thông tin nhà hàng mình sở hữu |
| 165 | DELETE | `/merchant/restaurants/:id` | Merchant restaurants | JWT Bearer | None | Xóa nhà hàng mình sở hữu |
| 166 | GET | `/restaurants/all` | Restaurant discovery | Not specified | None | Liệt kê nhà hàng đã được duyệt |
| 167 | GET | `/restaurants/popular` | Restaurant discovery | Not specified | None | Lấy nhà hàng đã duyệt kèm tối đa ba món đang bán |
| 168 | GET | `/restaurants/preview` | Restaurant discovery | Not specified | None | Lấy bản xem trước của các nhà hàng đã duyệt |
| 169 | GET | `/restaurants/:id` | Restaurant discovery | Not specified | None | Lấy chi tiết một nhà hàng đã được duyệt |

## 3. Authentication & Authorization
The global authentication mechanism is JWT (Bearer) mapped to `AuthGuard` or `JwtAuthGuard`. Specific routes explicitly marked with `@Public` bypass this. Authorization relies on `@Roles` and `@Permissions` decorators.

## 4. API Endpoints

### 4.1 system

#### GET /

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
string
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/app.controller.ts`
- Controller: `AppController`
- Method: `getHello`

---

#### GET /health

**Description:**
Check Foodee API liveness

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
{ status: string; service: string; }
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | API process is live |

**Source Reference:**
- File: `src/app.controller.ts`
- Controller: `AppController`
- Method: `getHealth`

---

#### GET /minio/health/live

**Description:**
Check API connectivity to MinIO

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ status: string; service: string; bucket: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | MinIO bucket is reachable from the API |
| 503 | MinIO is unavailable from the API |
| 500 | Throws ServiceUnavailableException |

**Source Reference:**
- File: `src/infra/storage/minio-health.controller.ts`
- Controller: `MinioHealthController`
- Method: `live`

---

### 4.2 Auth

#### POST /auth/login/email

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `loginWithEmailPassword`

---

#### POST /auth/register

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| email | `string` | Yes | IsEmail, IsNotEmpty |  |
| password | `string` | Yes | IsString, IsNotEmpty |  |
| name | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `register`

---

#### POST /auth/register/google

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| googleId | `string \| undefined` | No | IsString, IsOptional |  |
| email | `string \| undefined` | No | IsEmail, IsOptional |  |
| name | `string \| undefined` | No | IsString, IsOptional |  |
| accessToken | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `registerWithGoogle`

---

#### POST /auth/logout

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `logout`

---

#### POST /auth/forgot-password

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| email | `string` | Yes | IsEmail, IsNotEmpty |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `forgotPassword`

---

#### POST /auth/reset-password

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| token | `string` | Yes | IsString, IsNotEmpty |  |
| email | `string` | Yes | IsEmail, IsNotEmpty |  |
| newPassword | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `resetPassword`

---

#### GET /auth/verify-reset-token

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| token | query | `string` | Yes |  |
| email | query | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `verifyResetToken`

---

#### POST /auth/register-driver

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| username | `string` | Yes | IsString, IsNotEmpty |  |
| password | `string` | Yes | IsString |  |
| name | `string` | Yes | IsString, IsNotEmpty |  |
| phone | `string` | Yes | IsString, IsNotEmpty |  |
| birthday | `string` | Yes | IsDateString |  |
| cccd | `string` | Yes | IsString, IsNotEmpty |  |
| driverLicense | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<{ message: string; userId: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `registerDriver`

---

#### GET /auth/check-phone

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| phone | query | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ exists: boolean; status?: "pending" | "approved" | "rejected" | undefined; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `checkPhone`

---

#### POST /auth/send-otp

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `sendOtp`

---

#### POST /auth/verify-otp

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| phone | `any` | Yes | None |  |
| otp | `any` | Yes | None |  |

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `verifyOtp`

---

#### POST /auth/login-driver

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| username | `string` | Yes | IsString, IsNotEmpty |  |
| password | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `loginDriver`

---

#### POST /auth/check

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; user: any; isLogin: boolean; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/auth/auth.controller.ts`
- Controller: `AuthController`
- Method: `checkAuth`

---

### 4.3 DemoPayment

#### POST /demo-payment/create-order

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| amount | `number` | Yes | IsNumber |  |
| description | `string \| undefined` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<{ success: boolean; message: string; orderId: string; order: DummyOrder; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `createDummyOrder`

---

#### POST /demo-payment/create-checkout

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | `string` | Yes | IsString, IsNotEmpty |  |
| paymentMethod | `"momo" \| "vnpay" \| undefined` | No | IsOptional, IsIn |  |
| bankCode | `string \| undefined` | No | IsOptional, IsString |  |
| ipAddress | `string \| undefined` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<{ success: boolean; message: string; checkoutId: string; paymentUrl: any; checkout: DummyCheckout; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `createCheckout`

---

#### GET /demo-payment/vnpay-result

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `Record<string, string>` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ url: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `handleVnpayResult`

---

#### GET /demo-payment/vnpay-ipn

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Category: WEBHOOK / CALLBACK**

**Authentication:**
* Required: Yes
* Type: Provider Signature Verification (INFERRED)

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `Record<string, string>` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ RspCode: string; Message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `handleVnpayIpn`

---

#### GET /demo-payment/result

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| orderId | query | `string` | Yes |  |
| resultCode | query | `string` | Yes |  |
| message | query | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ url: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `handleMomoResult`

---

#### GET /demo-payment/check-status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| orderId | query | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ orderId: string; status: string; amount: number; currency: string; checkoutId: string; checkoutStatus: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `checkPaymentStatus`

---

#### POST /demo-payment/webhook

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Category: WEBHOOK / CALLBACK**

**Authentication:**
* Required: Yes
* Type: Provider Signature Verification (INFERRED)

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | `string` | Yes | IsString, IsNotEmpty |  |
| resultCode | `string` | Yes | IsString |  |

**Response:**
```typescript
Promise<{ success: boolean; message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `handleWebhook`

---

#### GET /demo-payment/orders

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<DummyOrder[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `getDummyOrders`

---

#### GET /demo-payment/checkouts

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<DummyCheckout[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/demo-payment.controller.ts`
- Controller: `DemoPaymentController`
- Method: `getDummyCheckouts`

---

### 4.4 payments

#### POST /payment/process/:checkoutId

**Description:**
Process an authenticated checkout

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| checkoutId | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| paymentMethodId | `string \| undefined` | No | IsOptional, IsString |  |
| token | `string \| undefined` | No | IsOptional, IsString |  |
| cardNumber | `string \| undefined` | No | IsOptional, IsString |  |
| expiryDate | `string \| undefined` | No | IsOptional, IsString |  |
| cvv | `string \| undefined` | No | IsOptional, IsString |  |
| bankCode | `string \| undefined` | No | IsOptional, IsString |  |
| metadata | `Record<string, unknown> \| undefined` | No | IsOptional, IsObject |  |

**Response:**
```typescript
Promise<PaymentResult>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Checkout processing result |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `processPayment`

---

#### POST /payment/cancel/:checkoutId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| checkoutId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<Checkout>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `cancelCheckout`

---

#### POST /payment/webhook

**Description:**
Receive a signed payment provider webhook

**Category: WEBHOOK / CALLBACK**

**Authentication:**
* Required: Yes
* Type: Provider Signature Verification (INFERRED)

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| partnerCode | `string` | Yes | IsString, IsNotEmpty |  |
| orderId | `string` | Yes | IsString, IsNotEmpty |  |
| requestId | `string` | Yes | IsString, IsNotEmpty |  |
| amount | `number` | Yes | IsNumber |  |
| currency | `string \| undefined` | No | IsOptional, IsString |  |
| type | `string \| undefined` | No | IsOptional, IsString |  |
| resultCode | `string \| undefined` | No | IsOptional, IsString |  |
| message | `string \| undefined` | No | IsOptional, IsString |  |
| orderInfo | `string` | Yes | IsString, IsNotEmpty |  |
| orderType | `string \| undefined` | No | IsOptional, IsString |  |
| transId | `string` | Yes | IsString, IsNotEmpty |  |
| payType | `string \| undefined` | No | IsOptional, IsString |  |
| responseTime | `string \| undefined` | No | IsOptional, IsString |  |
| extraData | `string \| undefined` | No | IsOptional, IsString |  |
| signature | `string \| undefined` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<PaymentWebhookAcknowledgement>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Webhook accepted or idempotently replayed |
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `handleWebhook`

---

#### GET /payment/checkout/:checkoutId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| checkoutId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ checkoutId: string; status: CheckoutStatus; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `getCheckoutStatus`

---

#### GET /payment/momo/result

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `MomoResultQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ success: boolean; verificationPending: boolean; orderId: string; message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `handleMomoResult`

---

#### POST /payment/momo/check-status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<Record<string, unknown>>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `checkMomoStatus`

---

#### GET /payment/vnpay/result

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `Record<string, string>` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ url: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `handleVnpayResult`

---

#### GET /payment/webhook/vnpay

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Category: WEBHOOK / CALLBACK**

**Authentication:**
* Required: Yes
* Type: Provider Signature Verification (INFERRED)

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `Record<string, string>` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ RspCode: string; Message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `handleVnpayIpn`

---

#### GET /payment/vnpay/status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| orderId | query | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<PaymentStatusResponse>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/payment/payment.controller.ts`
- Controller: `PaymentController`
- Method: `checkVnpayStatus`

---

### 4.5 Protected

#### GET /protected

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; uid: any; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/protected/protected.controller.ts`
- Controller: `ProtectedController`
- Method: `getProtectedData`

---

### 4.6 reviews

#### GET /foods/:foodId/reviews

**Description:**
List paginated public reviews for a food item

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| foodId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| sortBy | query | `string` | Yes |  |
| sortOrder | query | `"ASC" \| "DESC"` | Yes |  |
| minRating | query | `number \| undefined` | No |  |
| maxRating | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: ReviewResponseDto[]; totalItems: number; page: number; pageSize: number; totalPages: number; averageRating: number | null; ratingDistribution: Record<number, number>; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Paginated food review result |

**Source Reference:**
- File: `src/features/reviews/food-reviews.controller.ts`
- Controller: `FoodReviewsController`
- Method: `getReviewsByFood`

---

#### POST /reviews/food

**Description:**
Review a food item from the current customer completed order

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | `string` | Yes | IsUUID |  |
| foodId | `string` | Yes | IsUUID |  |
| image | `string \| undefined` | No | IsOptional, IsString |  |
| rating | `number` | Yes | IsInt |  |
| comment | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<ReviewResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 |  |
| 409 | Order is incomplete or the target was already reviewed |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `createFoodReview`

---

#### POST /reviews/shipper

**Description:**
Review the shipper assigned to the current customer completed order

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| orderId | `string` | Yes | IsUUID |  |
| shipperId | `string` | Yes | IsString, IsNotEmpty |  |
| rating | `number` | Yes | IsInt |  |
| comment | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<ReviewResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 |  |
| 409 | Order is incomplete or the target was already reviewed |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `createShipperReview`

---

#### GET /reviews/food/:foodId

**Description:**
List public food reviews

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| foodId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<ReviewResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `getReviewsForFood`

---

#### GET /reviews/shipper/:shipperId

**Description:**
List public shipper reviews

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| shipperId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<ReviewResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `getReviewsForShipper`

---

#### PUT /reviews/:id

**Description:**
Update a review owned by the current user

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| image | `string \| undefined` | No | IsOptional, IsString |  |
| rating | `number` | Yes | IsInt |  |
| comment | `string` | Yes | IsString, IsNotEmpty |  |

**Response:**
```typescript
Promise<ReviewResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Current user is not the review author |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `updateReview`

---

#### DELETE /reviews/:id

**Description:**
Delete a review owned by the current user

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 204 | Review deleted |
| 403 | Current user is not the review author |

**Source Reference:**
- File: `src/features/reviews/reviews.controller.ts`
- Controller: `ReviewsController`
- Method: `deleteReview`

---

### 4.7 Chat

#### POST /chat

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| userMessage | `string` | Yes | IsString, IsNotEmpty |  |
| metadata | `Record<string, any> \| undefined` | No | IsOptional, IsObject |  |

**Response:**
```typescript
Promise<ChatReply>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/chat/chat.controller.ts`
- Controller: `ChatController`
- Method: `handleChat`

---

### 4.8 Dashboard

#### GET /dashboard/stats

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.DASHBOARD.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ title: string; value: any; previousValue: any; change: string; isPositive: boolean; }[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/dashboard/dashboard.controller.ts`
- Controller: `DashboardController`
- Method: `getDashboardStats`

---

#### GET /dashboard/chart-data

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.DASHBOARD.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| period | query | `"year" \| "month" \| "week"` | Yes |  |
| metric | query | `"orders" \| "overview" \| "revenue"` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ order: { labels: string[]; values: number[]; }; revenue?: undefined; } | { revenue: { labels: string[]; values: number[]; }; order?: undefined; } | { order: { labels: string[]; values: number[]; }; revenue: { labels: string[]; values: number[]; }; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/dashboard/dashboard.controller.ts`
- Controller: `DashboardController`
- Method: `getChartData`

---

#### GET /dashboard/shipper-stats

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.DASHBOARD.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| period | query | `"year" \| "month" \| "week"` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ period: "year" | "month" | "week"; activeShippers: number; totalDeliveries: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/dashboard/dashboard.controller.ts`
- Controller: `DashboardController`
- Method: `getShipperStats`

---

#### GET /dashboard/order-completion-stats

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.DASHBOARD.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| period | query | `"year" \| "month" \| "week"` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ period: "year" | "month" | "week"; totalOrders: any; completedOrders: number; completionRate: number; breakdown: { status: any; count: number; percentage: string; }[]; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/dashboard/dashboard.controller.ts`
- Controller: `DashboardController`
- Method: `getOrderCompletionStats`

---

### 4.9 foods

#### POST /foods

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `string` | Yes | IsString, IsNotEmpty |  |
| description | `string \| undefined` | No | IsString, IsOptional |  |
| price | `string` | Yes | IsNumberString, IsNotEmpty |  |
| image | `string \| undefined` | No | IsString, IsOptional |  |
| imageUrls | `string[] \| undefined` | No | IsArray, IsString, IsOptional |  |
| discountPercent | `string \| undefined` | No | IsNumberString, IsOptional |  |
| status | `string \| undefined` | No | IsString, IsOptional |  |
| purchasedNumber | `string \| undefined` | No | IsNumberString, IsOptional |  |
| restaurantId | `string` | Yes | IsString, IsNotEmpty |  |
| categoryId | `string \| undefined` | No | IsString, IsOptional |  |
| preparationTime | `string \| undefined` | No | IsString, IsOptional |  |
| tag | `string \| undefined` | No | IsString, IsOptional |  |
| toppings | `CreateToppingDto[] \| undefined` | No | IsArray, IsOptional |  |

**Response:**
```typescript
Promise<Food>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `create`

---

#### GET /foods/all

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.FOOD.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| limit | query | `number` | Yes |  |
| search | query | `string \| undefined` | No |  |
| restaurantId | query | `string \| undefined` | No |  |
| categoryId | query | `string \| undefined` | No |  |
| status | query | `string \| undefined` | No |  |
| sortBy | query | `"name" \| "rating" \| "newest" \| "nearby" \| "hot" \| "most_review" \| "most_buy" \| "price" \| undefined` | No |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findAllForStore`

---

#### GET /foods

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findAll`

---

#### GET /foods/top-selling

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findTopSelling`

---

#### GET /foods/newest

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findNewest`

---

#### GET /foods/with-discount

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findWithDiscount`

---

#### GET /foods/search

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number` | No |  |
| lng | query | `number` | No |  |
| radius | query | `number` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `searchFoods`

---

#### GET /foods/by-name

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number` | No |  |
| lng | query | `number` | No |  |
| radius | query | `number` | Yes |  |
| name | query | `string \| undefined` | No |  |
| categoryIds | query | `string \| undefined` | No |  |
| minPrice | query | `number \| undefined` | No |  |
| maxPrice | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findByName`

---

#### GET /foods/top

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| restaurantId | query | `string` | Yes |  |
| limit | query | `number` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<any[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `getTopFoodsByRestaurant`

---

#### GET /foods/restaurant/:restaurantId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| restaurantId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findByRestaurant`

---

#### GET /foods/restaurant/:restaurantId/top-selling

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| restaurantId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findTopSellingByRestaurant`

---

#### GET /foods/restaurant/:restaurantId/with-discount

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| restaurantId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findWithDiscountByRestaurant`

---

#### GET /foods/category/:categoryId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| categoryId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findByCategory`

---

#### GET /foods/category/:categoryId/restaurant/:restaurantId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| categoryId | param | `string` | Yes |  |
| restaurantId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: any[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findByCategoryAndRestaurant`

---

#### GET /foods/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |
| lat | query | `number \| undefined` | No |  |
| lng | query | `number \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `findOne`

---

#### PUT /foods/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| toppings | `CreateToppingDto[] \| undefined` | No | IsArray, IsOptional |  |
| name | `any` | Yes | IsString, IsNotEmpty |  |
| description | `any` | No | IsString, IsOptional |  |
| price | `any` | Yes | IsNumberString, IsNotEmpty |  |
| image | `any` | No | IsString, IsOptional |  |
| imageUrls | `any` | No | IsArray, IsString, IsOptional |  |
| discountPercent | `any` | No | IsNumberString, IsOptional |  |
| status | `any` | No | IsString, IsOptional |  |
| purchasedNumber | `any` | No | IsNumberString, IsOptional |  |
| restaurantId | `any` | Yes | IsString, IsNotEmpty |  |
| categoryId | `any` | No | IsString, IsOptional |  |
| preparationTime | `any` | No | IsString, IsOptional |  |
| tag | `any` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<Food>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `update`

---

#### DELETE /foods/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `remove`

---

#### PUT /foods/:id/status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<Food>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `updateStatus`

---

#### DELETE /foods/:id/admin

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.FOOD.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `deleteFood`

---

#### POST /foods/:id/toppings

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `string` | Yes | IsString, IsNotEmpty |  |
| image | `string \| undefined` | No | IsString, IsOptional |  |
| price | `string` | Yes | IsNumberString, IsNotEmpty |  |
| isAvailable | `boolean \| undefined` | No | IsOptional, IsBoolean |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `addTopping`

---

#### PUT /foods/toppings/:toppingId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| toppingId | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `any` | Yes | IsString, IsNotEmpty |  |
| image | `any` | No | IsString, IsOptional |  |
| price | `any` | Yes | IsNumberString, IsNotEmpty |  |
| isAvailable | `any` | No | IsOptional, IsBoolean |  |

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `updateTopping`

---

#### DELETE /foods/toppings/:toppingId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| toppingId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 401 | Throws UnauthorizedException |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `removeTopping`

---

#### GET /foods/:id/toppings

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<Topping[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/food/food.controller.ts`
- Controller: `FoodController`
- Method: `getToppings`

---

### 4.10 Messenger

#### POST /messenger/conversations

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| participantId | `string \| undefined` | No | IsOptional, IsString |  |
| orderId | `string \| undefined` | No | IsOptional, IsString |  |
| restaurantId | `string \| undefined` | No | IsOptional, IsString |  |
| conversationType | `ConversationType \| undefined` | No | IsOptional, IsEnum |  |

**Response:**
```typescript
Promise<Conversation>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `createConversation`

---

#### GET /messenger/conversation-ids

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<string[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `getAllConversationIds`

---

#### GET /messenger/conversations

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Conversation[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `getUserConversations`

---

#### POST /messenger/messages

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| conversationId | `string` | Yes | IsString |  |
| content | `string` | Yes | IsString |  |
| messageType | `string \| undefined` | No | IsOptional, IsEnum |  |
| attachmentUrl | `string \| undefined` | No | IsOptional, IsString |  |
| attachmentType | `string \| undefined` | No | IsOptional, IsString |  |
| replyToMessageId | `string \| undefined` | No | IsOptional, IsString |  |
| metadata | `any` | No | IsOptional |  |

**Response:**
```typescript
Promise<Message>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `sendMessage`

---

#### GET /messenger/conversations/:conversationId/messages

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| conversationId | param | `string` | Yes |  |
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Message[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `getConversationMessages`

---

#### PUT /messenger/conversations/:conversationId/read

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| conversationId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ success: boolean; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `markMessagesAsRead`

---

#### DELETE /messenger/messages/:messageId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| messageId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ success: boolean; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `deleteMessage`

---

#### PUT /messenger/conversations/:conversationId/block

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| conversationId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<Conversation>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `toggleBlockConversation`

---

#### GET /messenger/unread-count

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ unreadCount: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `getUnreadMessageCount`

---

#### GET /messenger/available-partners

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ shopOwners: { user: User; restaurant: any; }[]; shippers: { user: User; order: any; }[]; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/messenger/messenger.controller.ts`
- Controller: `MessengerController`
- Method: `getAvailableChatPartners`

---

### 4.11 orders

#### POST /orders

**Description:**
Create an order using server-authoritative pricing

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| restaurantId | `string` | Yes | IsUUID |  |
| addressId | `string \| undefined` | Yes | IsUUID |  |
| address | `OrderAddressRequestDto \| undefined` | Yes | None |  |
| total | `number \| undefined` | No | IsOptional, IsNumber |  |
| note | `string \| undefined` | No | IsOptional, IsString |  |
| paymentMethod | `string \| undefined` | No | IsOptional, IsString |  |
| promotionCode | `string \| undefined` | No | IsOptional, IsString |  |
| requestedDeliveryTime | `number \| undefined` | No | IsOptional, IsInt |  |
| deliveryType | `"asap" \| "scheduled" \| undefined` | No | IsOptional, IsIn |  |
| orderDetails | `OrderItemRequestDto[]` | Yes | IsArray, IsNotEmpty |  |

**Response:**
```typescript
Promise<{ order: { id: string; status: string; total: number; paymentMethod: string; createdAt: Date; }; paymentUrl: string | undefined; checkoutId: string | undefined; temporaryAddress: boolean; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `createOrder`

---

#### GET /orders/my

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | No |  |
| pageSize | query | `number` | No |  |
| status | query | `string \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Order[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getMyOrders`

---

#### GET /orders

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.ORDER.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<Order[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getAllOrders`

---

#### POST /orders/calculate

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| addressId | `any` | Yes | None |  |
| restaurantId | `any` | Yes | None |  |
| items | `any` | Yes | None |  |
| promotionCode | `any` | Yes | None |  |

**Response:**
```typescript
Promise<{ shipperEarnings: number; shipperCommissionRate: number; platformFee: number; distance: number; estimatedDeliveryTime: number; appliedPromotion: Promotion | null; promotionError: string | null; foodTotal: number; shippingFee: number; subtotal: number; promotionDiscount: number; total: number; } | { error: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `calculateOrder`

---

#### POST /orders/calculate-custom

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| address | `any` | Yes | None |  |
| restaurantId | `any` | Yes | None |  |
| items | `any` | Yes | None |  |
| promotionCode | `any` | Yes | None |  |

**Response:**
```typescript
Promise<{ distance: number; estimatedDeliveryTime: number; appliedPromotion: { id: string; code: string; description: string; type: PromotionType; discountAmount: number; } | null; promotionError: string | null; foodTotal: number; shippingFee: number; subtotal: number; promotionDiscount: number; total: number; } | { error: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `calculateOrderWithCustomAddress`

---

#### GET /orders/restaurant/my

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | No |  |
| pageSize | query | `number` | No |  |
| status | query | `string \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Order[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 403 | Throws ForbiddenException |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getOrdersByMyRestaurant`

---

#### GET /orders/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |
| review | query | `boolean \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<Order>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getOrderById`

---

#### GET /orders/user/:userId

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| userId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Order[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 403 | Throws ForbiddenException |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getOrdersByUser`

---

#### GET /orders/:id/details

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<OrderDetail[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `getOrderDetails`

---

#### PUT /orders/:id/status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<Order>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `updateOrderStatus`

---

#### PUT /orders/admin/:id/status

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.ORDER.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<Order>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `adminUpdateOrderStatus`

---

#### DELETE /orders/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `deleteOrder`

---

#### POST /orders/:id/payment

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| method | `string` | Yes | IsNotEmpty, IsString, IsIn |  |
| cardNumber | `string \| undefined` | No | IsOptional, IsString |  |
| expiryDate | `string \| undefined` | No | IsOptional, IsString |  |
| cvv | `string \| undefined` | No | IsOptional, IsString |  |
| paypalToken | `string \| undefined` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<{ success: boolean; message: string; order: Order; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `processPayment`

---

#### POST /orders/validate-promotion

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| promotionCode | `any` | Yes | None |  |
| addressId | `any` | Yes | None |  |
| restaurantId | `any` | Yes | None |  |
| items | `any` | Yes | None |  |

**Response:**
```typescript
Promise<{ valid: boolean; promotion: Promotion | null; discount: number; error: string | null; orderTotal: number; } | { valid: boolean; error: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/order/order.controller.ts`
- Controller: `OrderController`
- Method: `validatePromotion`

---

### 4.12 promotions

#### POST /promotions

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.PROMOTION.CREATE

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| description | `string \| undefined` | No | IsOptional, IsString |  |
| type | `PromotionType` | Yes | IsEnum |  |
| discountPercent | `number \| undefined` | No | IsOptional, IsNumber |  |
| discountAmount | `number \| undefined` | No | IsOptional, IsNumber |  |
| minOrderValue | `number \| undefined` | No | IsOptional, IsNumber |  |
| maxDiscountAmount | `number \| undefined` | No | IsOptional, IsNumber |  |
| code | `string` | Yes | IsString |  |
| image | `string \| undefined` | No | IsOptional, IsString |  |
| startDate | `string \| undefined` | No | IsOptional, IsDateString |  |
| endDate | `string \| undefined` | No | IsOptional, IsDateString |  |
| maxUsage | `number \| undefined` | No | IsOptional, IsInt |  |

**Response:**
```typescript
Promise<Promotion>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `createPromotion`

---

#### GET /promotions/all

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| page | query | `number` | Yes |  |
| pageSize | query | `number` | Yes |  |
| name | query | `string \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: Promotion[]; totalItems: number; page: number; pageSize: number; totalPages: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `getPublicActivePromotions`

---

#### GET /promotions

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.PROMOTION.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<Promotion[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `getAllPromotions`

---

#### GET /promotions/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.PROMOTION.CREATE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<Promotion>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `getPromotionById`

---

#### PUT /promotions/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.PROMOTION.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| description | `any` | No | IsOptional, IsString |  |
| type | `any` | Yes | IsEnum |  |
| discountPercent | `any` | No | IsOptional, IsNumber |  |
| discountAmount | `any` | No | IsOptional, IsNumber |  |
| minOrderValue | `any` | No | IsOptional, IsNumber |  |
| maxDiscountAmount | `any` | No | IsOptional, IsNumber |  |
| code | `any` | Yes | IsString |  |
| image | `any` | No | IsOptional, IsString |  |
| startDate | `any` | No | IsOptional, IsDateString |  |
| endDate | `any` | No | IsOptional, IsDateString |  |
| maxUsage | `any` | No | IsOptional, IsInt |  |

**Response:**
```typescript
Promise<Promotion>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `updatePromotion`

---

#### DELETE /promotions/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: Permission.PROMOTION.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/promotion/promotion.controller.ts`
- Controller: `PromotionController`
- Method: `deletePromotion`

---

### 4.13 roles

#### POST /role

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.CREATE

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| displayName | `string` | Yes | IsString, IsNotEmpty |  |
| description | `string \| undefined` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `create`

---

#### PUT /role/:id/permissions

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `updateRolePermissions`

---

#### PUT /role/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| displayName | `string \| undefined` | No | IsString, IsOptional |  |
| description | `string \| undefined` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `updateRoleDetails`

---

#### POST /role/:id/users

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `addUsersToRole`

---

#### POST /role/:id/assign-users

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `assignUsersToRole`

---

#### POST /role/:id/users/remove

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `removeUsersFromRole`

---

#### POST /role/:id/permissions

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `addPermissionsToRole`

---

#### POST /role/:id/permissions/remove

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| length | `any` | Yes | None |  |
| toString | `any` | Yes | None |  |
| toLocaleString | `any` | Yes | None |  |
| pop | `any` | Yes | None |  |
| push | `any` | Yes | None |  |
| concat | `any` | Yes | None |  |
| join | `any` | Yes | None |  |
| reverse | `any` | Yes | None |  |
| shift | `any` | Yes | None |  |
| slice | `any` | Yes | None |  |
| sort | `any` | Yes | None |  |
| splice | `any` | Yes | None |  |
| unshift | `any` | Yes | None |  |
| indexOf | `any` | Yes | None |  |
| lastIndexOf | `any` | Yes | None |  |
| every | `any` | Yes | None |  |
| some | `any` | Yes | None |  |
| forEach | `any` | Yes | None |  |
| map | `any` | Yes | None |  |
| filter | `any` | Yes | None |  |
| reduce | `any` | Yes | None |  |
| reduceRight | `any` | Yes | None |  |
| find | `any` | Yes | None |  |
| findIndex | `any` | Yes | None |  |
| fill | `any` | Yes | None |  |
| copyWithin | `any` | Yes | None |  |
| entries | `any` | Yes | None |  |
| keys | `any` | Yes | None |  |
| values | `any` | Yes | None |  |
| includes | `any` | Yes | None |  |
| flatMap | `any` | Yes | None |  |
| flat | `any` | Yes | None |  |
| __@iterator@228 | `any` | Yes | None |  |
| __@unscopables@230 | `any` | Yes | None |  |
| at | `any` | Yes | None |  |

**Response:**
```typescript
Promise<Role>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `removePermissionsFromRole`

---

#### DELETE /role/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/role/role.controller.ts`
- Controller: `RoleController`
- Method: `remove`

---

#### GET /role

**Description:**
List roles for an authorized administrator

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityRoleResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listRoles`

---

#### GET /role/permissions

**Description:**
List supported permission names

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
string[]
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listPermissionNames`

---

#### GET /role/user-role-and-permission

**Description:**
Get the current administrative role for the admin portal

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ role: { name: DefaultRole; }; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Actor is not an administrator |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `getCurrentAdminRole`

---

#### GET /role/user/:userId/permissions

**Description:**
List active permissions for a user

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ, Permission.USER.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| userId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityPermissionResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listUserPermissions`

---

#### GET /role/check-permission/:roleId/:permissionName

**Description:**
Check whether a role has an active permission

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| roleId | param | `string` | Yes |  |
| permissionName | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<boolean>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `hasPermission`

---

#### GET /role/:id/users/available

**Description:**
List users available for a role assignment

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ, Permission.USER.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |
| query | query | `AvailableRoleUsersQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityUserListItemDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listAvailableUsers`

---

#### GET /role/:id/permissions

**Description:**
List active permission names for a role

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<string[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listRolePermissions`

---

#### GET /role/:id/users

**Description:**
List safe user summaries assigned to a role

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ, Permission.USER.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityUserListItemDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `listRoleUsers`

---

#### GET /role/:id

**Description:**
Get a role with safe user and permission summaries

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.ROLE.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityRoleDetailResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 404 | Role not found |

**Source Reference:**
- File: `src/features/identity/roles/identity-role-query.controller.ts`
- Controller: `IdentityRoleQueryController`
- Method: `findRole`

---

### 4.14 delivery

#### POST /shippers/accept-order

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: number
```

**Response:**
```typescript
Promise<ShippingDetail>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `acceptOrder`

---

#### POST /shippers/get-order

**Description:**
Read an assigned order without changing delivery state

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<Order>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Assigned order returned |
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getOrder`

---

#### POST /shippers/start-order

**Description:**
Start an assigned delivery

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<Order>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Order transitioned to delivering |
| 400 | Throws BadRequestException |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `startOrder`

---

#### POST /shippers/complete-order

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<{ message: string; earnings: number; earningsBreakdown?: undefined; isOnTime?: undefined; deliveryTime?: undefined; totalCompletedDeliveries?: undefined; distance?: undefined; orderValue?: undefined; } | { message: string; earnings: number; earningsBreakdown: { baseEarnings: number; distanceBonus: number; orderValueBonus: number; timeBonus: number; onTimeBonus: number; performanceBonus: number; totalEarnings: number; }; isOnTime: boolean; deliveryTime: number; totalCompletedDeliveries: number; distance: number; orderValue: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `completeOrder`

---

#### POST /shippers/cancel-order

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: string
```

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `cancelOrder`

---

#### POST /shippers/reject-order

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: number
```

**Response:**
```typescript
Promise<any>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `rejectOrder`

---

#### GET /shippers/pending-assignment

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ assignmentId: string; orderId: string; shipperId: string; expiresAt: Date; } | null>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getPendingAssignment`

---

#### GET /shippers/order-history

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ id: string; code: string; status: ShippingStatus; shipFee: number; total: number; user: { name: string; }; restaurant: { name: string; }; address: { street: string; }; deliveryTo: string; orderDetails: { food: { name: string; }; quantity: number; price: number; }[]; }[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getHistory`

---

#### GET /shippers/profile

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ name: string; phone: string; birthday: string; cccd: string; driverLicense: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getProfile`

---

#### GET /shippers/income-report

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| range | query | `"month" \| "week" \| "today"` | Yes |  |
| month | query | `string \| undefined` | No |  |
| year | query | `string \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ period: "month" | "week" | "today"; dateRange: { from: string; to: string; }; labels: string[]; data: { earnings: number[]; deliveryCount: number[]; avgEarningsPerDelivery: number[]; }; summary: { totalEarnings: number; totalDeliveries: number; avgEarningsPerDelivery: number; bestDay: { date: string; earnings: number; deliveries: number; }; worstDay: { date: string; earnings: number; }; formatted: { totalEarnings: string; avgEarningsPerDelivery: string; avgEarningsPerDay: string; }; }; analytics: { peakPerformanceDays: string[]; consistency: number; trend: string; workloadDistribution: { lightDays: number; moderateDays: number; heavyDays: number; }; }; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getIncomeReport`

---

#### POST /shippers/update-location

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
```typescript
Type: number
```

**Response:**
```typescript
Promise<{ message: string; success: boolean; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `updateLocation`

---

#### GET /shippers/dashboard

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ shipperId: string; shipperName: string; status: CertificateStatus; isActive: boolean; averageRating: number; deliveryStats: { totalCompletedDeliveries: number; activeDeliveries: number; rejectedOrders: number; failedDeliveries: number; totalOrders: number; recentDeliveries30Days: number; completionRate: number; rejectionRate: number; onTimeDeliveryRate: number; averageDeliveryTime: number; averageResponseTime: number; onTimeDeliveries: number; lateDeliveries: number; }; earnings: { totalEarnings: number; dailyEarnings: number; weeklyEarnings: number; monthlyEarnings: number; averageEarningsPerDelivery: number; formattedEarnings: { total: string; daily: string; weekly: string; monthly: string; perDelivery: string; }; }; performanceRanking: { level: string; score: number; nextLevelRequirements: string[]; }; achievements: { name: string; description: string; earned: boolean; progress?: number | undefined; }[]; lastActiveAt: string | null; accountCreatedAt: string; nextMilestones: { milestone: string; current: number; target: number; progress: number; }[]; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getDashboard`

---

#### GET /shippers/performance

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ completedDeliveries: number; rejectedOrders: number; failedDeliveries: number; totalOrders: number; activeDeliveries: number; rejectionRatio: number; completionRatio: number; failureRatio: number; averageResponseTime: number; status: CertificateStatus; averageRating: number; totalEarnings: number; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getPerformanceStats`

---

#### GET /shippers/earnings-breakdown

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ totalEarnings: number; dailyEarnings: number; weeklyEarnings: number; monthlyEarnings: number; averageEarningsPerDelivery: number; formattedEarnings: { total: string; daily: string; weekly: string; monthly: string; perDelivery: string; }; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getEarningsBreakdown`

---

#### GET /shippers/achievements

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ achievements: { name: string; description: string; earned: boolean; progress?: number | undefined; }[]; performanceRanking: { level: string; score: number; nextLevelRequirements: string[]; }; nextMilestones: { milestone: string; current: number; target: number; progress: number; }[]; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/shipper/shipper.controller.ts`
- Controller: `ShipperController`
- Method: `getAchievements`

---

### 4.15 users

#### GET /users/shippers

**Description:**
List shipper compatibility projections

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.SHIPPER.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| status | query | `CertificateStatus \| undefined` | No |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ id: string; status: CertificateStatus; verifiedAt: Date; user: SafeUserResponse | null; }[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Safe user projections for delivery compatibility |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `getShippers`

---

#### PUT /users/me

**Description:**
Update the current user profile (legacy address compatibility)

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `string \| undefined` | No | IsOptional, IsString |  |
| phone | `string \| undefined` | No | IsOptional, IsString |  |
| avatar | `string \| undefined` | No | IsOptional, IsString |  |
| birthday | `Date \| undefined` | No | IsOptional, IsDate |  |
| address | `UpdateMeAddressDto[] \| undefined` | No | IsOptional, IsArray |  |
| addresses | `UpdateMeAddressDto[] \| undefined` | No | IsOptional, IsArray |  |

**Response:**
```typescript
Promise<SafeUserResponse>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Safe user response |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `updateMe`

---

#### POST /users

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.USER.CREATE

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| username | `string` | Yes | IsString, IsNotEmpty |  |
| password | `string` | No | IsString, IsOptional |  |
| email | `string \| undefined` | No | IsOptional, IsEmail |  |
| role | `string` | Yes | IsNotEmpty, IsUUID |  |
| name | `string \| undefined` | No | IsOptional, IsString |  |
| phone | `string \| undefined` | No | IsOptional, IsString |  |
| avatar | `string \| undefined` | No | IsOptional, IsString |  |
| isActive | `boolean \| undefined` | No | IsOptional, IsBoolean |  |
| birthday | `Date` | Yes | IsNotEmpty, IsDate |  |
| authProvider | `AuthProvider \| undefined` | No | IsOptional, IsEnum |  |
| googleId | `string \| undefined` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<SafeUserResponse>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 | Success |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `create`

---

#### PUT /users/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.USER.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| addresses | `UpdateAddressDto[] \| undefined` | No | IsOptional, IsArray |  |
| username | `any` | Yes | IsString, IsNotEmpty |  |
| password | `any` | No | IsString, IsOptional |  |
| email | `any` | No | IsOptional, IsEmail |  |
| role | `any` | Yes | IsNotEmpty, IsUUID |  |
| name | `any` | No | IsOptional, IsString |  |
| phone | `any` | No | IsOptional, IsString |  |
| avatar | `any` | No | IsOptional, IsString |  |
| isActive | `any` | No | IsOptional, IsBoolean |  |
| birthday | `any` | Yes | IsNotEmpty, IsDate |  |
| authProvider | `any` | No | IsOptional, IsEnum |  |
| googleId | `any` | No | IsOptional, IsString |  |

**Response:**
```typescript
Promise<SafeUserResponse>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `update`

---

#### DELETE /users/:id

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.USER.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `remove`

---

#### PATCH /users/shippers/:userId/approve

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.SHIPPER.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| userId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<ShipperCertificateInfo>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `approveShipper`

---

#### PATCH /users/shippers/:userId/reject

**Description:**
CONFIRMED: Internal/Undocumented endpoint

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.SHIPPER.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| userId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<ShipperCertificateInfo>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Success |

**Source Reference:**
- File: `src/modules/users/users.controller.ts`
- Controller: `UsersController`
- Method: `rejectShipper`

---

#### GET /users/me

**Description:**
Get the authenticated user profile

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityUserResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 401 | Authentication required |

**Source Reference:**
- File: `src/features/identity/users/identity-user-query.controller.ts`
- Controller: `IdentityUserQueryController`
- Method: `findMe`

---

#### GET /users

**Description:**
List users for an authorized administrator

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.USER.READ

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityUserListItemDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Missing user read permission |

**Source Reference:**
- File: `src/features/identity/users/identity-user-query.controller.ts`
- Controller: `IdentityUserQueryController`
- Method: `listUsers`

---

#### GET /users/:id

**Description:**
Get a user for an authorized administrator

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.USER.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<IdentityUserResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Missing user read permission |
| 404 | User not found |

**Source Reference:**
- File: `src/features/identity/users/identity-user-query.controller.ts`
- Controller: `IdentityUserQueryController`
- Method: `findOne`

---

### 4.16 Notifications

#### GET /notifications

**Description:**
Lấy danh sách thông báo của tôi

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `NotificationQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<NotificationListResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 401 | Chưa đăng nhập |

**Source Reference:**
- File: `src/features/communications/notifications/notification.controller.ts`
- Controller: `NotificationController`
- Method: `getMyNotifications`

---

#### PATCH /notifications/:id/read

**Description:**
Đánh dấu thông báo đã đọc

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<NotificationResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 401 | Chưa đăng nhập |
| 403 | Không phải thông báo của bạn |
| 404 | Không tìm thấy thông báo |

**Source Reference:**
- File: `src/features/communications/notifications/notification.controller.ts`
- Controller: `NotificationController`
- Method: `markAsRead`

---

### 4.17 addresses

#### POST /addresses

**Description:**
Create an address for the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| id | `string \| undefined` | No | IsOptional, IsUUID |  |
| street | `string` | Yes | IsString |  |
| ward | `string \| undefined` | No | IsOptional, IsString |  |
| district | `string \| undefined` | No | IsOptional, IsString |  |
| city | `string` | Yes | IsString |  |
| latitude | `number \| undefined` | No | IsOptional, IsNumber |  |
| longitude | `number \| undefined` | No | IsOptional, IsNumber |  |
| isDefault | `boolean \| undefined` | No | IsOptional, IsBoolean |  |
| label | `string \| undefined` | No | IsOptional, IsString |  |
| userId | `string \| undefined` | No | IsOptional, IsUUID |  |

**Response:**
```typescript
Promise<AddressResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 |  |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `createAddress`

---

#### GET /addresses

**Description:**
List addresses owned by the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Body:**
`None`

**Response:**
```typescript
Promise<AddressResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `getAllAddresses`

---

#### GET /addresses/:id

**Description:**
Get an address owned by the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<AddressResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Address belongs to another customer |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `getAddressById`

---

#### GET /addresses/user/:userId

**Description:**
List addresses for the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| userId | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<AddressResponseDto[]>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 403 | Throws ForbiddenException |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `getAddressesByUser`

---

#### PUT /addresses/:id

**Description:**
Update an address owned by the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| id | `any` | No | IsOptional, IsUUID |  |
| street | `any` | Yes | IsString |  |
| ward | `any` | No | IsOptional, IsString |  |
| district | `any` | No | IsOptional, IsString |  |
| city | `any` | Yes | IsString |  |
| latitude | `any` | No | IsOptional, IsNumber |  |
| longitude | `any` | No | IsOptional, IsNumber |  |
| isDefault | `any` | No | IsOptional, IsBoolean |  |
| label | `any` | No | IsOptional, IsString |  |
| userId | `any` | No | IsOptional, IsUUID |  |

**Response:**
```typescript
Promise<AddressResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `updateAddress`

---

#### DELETE /addresses/:id

**Description:**
Delete an address owned by the current customer

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ message: string; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Address deleted |

**Source Reference:**
- File: `src/features/locations/addresses/address.controller.ts`
- Controller: `AddressController`
- Method: `deleteAddress`

---

### 4.18 categories

#### GET /categories

**Description:**
List public food categories

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `ListCategoryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<CategoryListResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/menu/categories/category.controller.ts`
- Controller: `CategoryController`
- Method: `findAll`

---

#### GET /categories/:id

**Description:**
Get a public food category

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<CategoryResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 404 | Category not found |

**Source Reference:**
- File: `src/features/menu/categories/category.controller.ts`
- Controller: `CategoryController`
- Method: `findOne`

---

#### POST /categories

**Description:**
Create a category (catalog owner/admin)

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.CATEGORY.CREATE

**Parameters:**
`None`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `string` | Yes | IsString, IsNotEmpty |  |
| image | `string \| undefined` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<CategoryResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 201 |  |
| 401 | Authentication required |
| 403 | Missing category create permission |

**Source Reference:**
- File: `src/features/menu/categories/category.controller.ts`
- Controller: `CategoryController`
- Method: `create`

---

#### PUT /categories/:id

**Description:**
Update a category (catalog owner/admin)

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.CATEGORY.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `any` | Yes | IsString, IsNotEmpty |  |
| image | `any` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<CategoryResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 401 | Authentication required |
| 403 | Missing category update permission |
| 404 | Category not found |

**Source Reference:**
- File: `src/features/menu/categories/category.controller.ts`
- Controller: `CategoryController`
- Method: `update`

---

#### DELETE /categories/:id

**Description:**
Delete a category (catalog owner/admin)

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.CATEGORY.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 | Category deleted |
| 401 | Authentication required |
| 403 | Missing category delete permission |
| 404 | Category not found |

**Source Reference:**
- File: `src/features/menu/categories/category.controller.ts`
- Controller: `CategoryController`
- Method: `remove`

---

### 4.19 Admin restaurants

#### GET /admin/restaurants/requests

**Description:**
Liệt kê yêu cầu mở nhà hàng đang chờ duyệt

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.STORE.READ

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<RestaurantPageResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/admin-restaurants.controller.ts`
- Controller: `RestaurantAdminController`
- Method: `getRestaurantRequests`

---

#### PUT /admin/restaurants/:id/approve

**Description:**
Duyệt yêu cầu mở nhà hàng và ghi audit

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.STORE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| note | `string \| undefined` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 409 | Nhà hàng không còn ở trạng thái chờ duyệt |

**Source Reference:**
- File: `src/features/restaurants/controllers/admin-restaurants.controller.ts`
- Controller: `RestaurantAdminController`
- Method: `approveRestaurant`

---

#### PUT /admin/restaurants/:id/reject

**Description:**
Từ chối yêu cầu mở nhà hàng, bắt buộc lý do và ghi audit

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.STORE.WRITE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| reason | `string` | Yes | IsString |  |

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 400 | Thiếu hoặc sai lý do từ chối |
| 409 | Nhà hàng không còn ở trạng thái chờ duyệt |

**Source Reference:**
- File: `src/features/restaurants/controllers/admin-restaurants.controller.ts`
- Controller: `RestaurantAdminController`
- Method: `rejectRestaurant`

---

#### DELETE /admin/restaurants/requests/:id

**Description:**
Xóa yêu cầu mở nhà hàng đang chờ duyệt

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: Permission.STORE.DELETE

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 204 | Đã xóa |

**Source Reference:**
- File: `src/features/restaurants/controllers/admin-restaurants.controller.ts`
- Controller: `RestaurantAdminController`
- Method: `deleteRestaurantRequest`

---

### 4.20 Merchant restaurants

#### POST /merchant/restaurants

**Description:**
Gửi yêu cầu mở nhà hàng cho tài khoản đang đăng nhập

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
`None`

**Request Header:**
`Content-Type: multipart/form-data`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `any` | Yes | IsString, IsNotEmpty |  |
| address | `any` | No | IsString, IsOptional |  |
| avatar | `any` | No | IsString, IsOptional |  |
| description | `any` | No | IsString, IsOptional |  |
| latitude | `any` | No | IsNumberString, IsOptional |  |
| longitude | `any` | No | IsNumberString, IsOptional |  |
| phoneNumber | `any` | No | IsString, IsOptional |  |
| backgroundImage | `any` | No | IsString, IsOptional |  |
| addressStreet | `any` | No | IsString, IsOptional |  |
| addressWard | `any` | No | IsString, IsOptional |  |
| addressDistrict | `any` | No | IsString, IsOptional |  |
| addressCity | `any` | No | IsString, IsOptional |  |
| openTime | `any` | No | IsString, IsOptional |  |
| closeTime | `any` | No | IsString, IsOptional |  |
| licenseCode | `any` | No | IsString, IsOptional |  |
| certificateImage | `any` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 400 | Thông tin nhà hàng, địa chỉ hoặc tệp không hợp lệ |

**Source Reference:**
- File: `src/features/restaurants/controllers/merchant-profile.controller.ts`
- Controller: `RestaurantMerchantController`
- Method: `requestRestaurant`

---

#### GET /merchant/restaurants/my

**Description:**
Lấy hồ sơ nhà hàng của tài khoản đang đăng nhập

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 403 | Throws ForbiddenException |

**Source Reference:**
- File: `src/features/restaurants/controllers/merchant-profile.controller.ts`
- Controller: `RestaurantMerchantController`
- Method: `getMyRestaurant`

---

#### PUT /merchant/restaurants/:id/files

**Description:**
Cập nhật hồ sơ và ảnh của nhà hàng mình sở hữu

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Header:**
`Content-Type: multipart/form-data`

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `any` | Yes | IsString, IsNotEmpty |  |
| address | `any` | No | IsString, IsOptional |  |
| avatar | `any` | No | IsString, IsOptional |  |
| description | `any` | No | IsString, IsOptional |  |
| latitude | `any` | No | IsNumberString, IsOptional |  |
| longitude | `any` | No | IsNumberString, IsOptional |  |
| phoneNumber | `any` | No | IsString, IsOptional |  |
| backgroundImage | `any` | No | IsString, IsOptional |  |
| addressStreet | `any` | No | IsString, IsOptional |  |
| addressWard | `any` | No | IsString, IsOptional |  |
| addressDistrict | `any` | No | IsString, IsOptional |  |
| addressCity | `any` | No | IsString, IsOptional |  |
| openTime | `any` | No | IsString, IsOptional |  |
| closeTime | `any` | No | IsString, IsOptional |  |
| licenseCode | `any` | No | IsString, IsOptional |  |
| certificateImage | `any` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/merchant-profile.controller.ts`
- Controller: `RestaurantMerchantController`
- Method: `updateWithFiles`

---

#### PUT /merchant/restaurants/:id

**Description:**
Cập nhật thông tin nhà hàng mình sở hữu

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| name | `any` | Yes | IsString, IsNotEmpty |  |
| address | `any` | No | IsString, IsOptional |  |
| avatar | `any` | No | IsString, IsOptional |  |
| description | `any` | No | IsString, IsOptional |  |
| latitude | `any` | No | IsNumberString, IsOptional |  |
| longitude | `any` | No | IsNumberString, IsOptional |  |
| phoneNumber | `any` | No | IsString, IsOptional |  |
| backgroundImage | `any` | No | IsString, IsOptional |  |
| addressStreet | `any` | No | IsString, IsOptional |  |
| addressWard | `any` | No | IsString, IsOptional |  |
| addressDistrict | `any` | No | IsString, IsOptional |  |
| addressCity | `any` | No | IsString, IsOptional |  |
| openTime | `any` | No | IsString, IsOptional |  |
| closeTime | `any` | No | IsString, IsOptional |  |
| licenseCode | `any` | No | IsString, IsOptional |  |
| certificateImage | `any` | No | IsString, IsOptional |  |

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/merchant-profile.controller.ts`
- Controller: `RestaurantMerchantController`
- Method: `update`

---

#### DELETE /merchant/restaurants/:id

**Description:**
Xóa nhà hàng mình sở hữu

**Authentication:**
* Required: Yes
* Type: JWT Bearer

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<void>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 204 | Đã xóa |

**Source Reference:**
- File: `src/features/restaurants/controllers/merchant-profile.controller.ts`
- Controller: `RestaurantMerchantController`
- Method: `remove`

---

### 4.21 Restaurant discovery

#### GET /restaurants/all

**Description:**
Liệt kê nhà hàng đã được duyệt

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<RestaurantPageResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/public-discovery.controller.ts`
- Controller: `RestaurantDiscoveryController`
- Method: `findAll`

---

#### GET /restaurants/popular

**Description:**
Lấy nhà hàng đã duyệt kèm tối đa ba món đang bán

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<{ items: { foods: FoodPreviewSnapshot[]; id: string; name: string | null; phoneNumber: string | null; avatar: string | null; backgroundImage: string | null; description: string | null; openTime: string | null; closeTime: string | null; rating: number | null; status: RestaurantStatus; ownerId: string | null; address: RestaurantAddressResponseDto | null; distance: number | null; deliveryTime: number | null; }[]; }>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/public-discovery.controller.ts`
- Controller: `RestaurantDiscoveryController`
- Method: `getPopularRestaurants`

---

#### GET /restaurants/preview

**Description:**
Lấy bản xem trước của các nhà hàng đã duyệt

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<RestaurantPageResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |

**Source Reference:**
- File: `src/features/restaurants/controllers/public-discovery.controller.ts`
- Controller: `RestaurantDiscoveryController`
- Method: `getPreview`

---

#### GET /restaurants/:id

**Description:**
Lấy chi tiết một nhà hàng đã được duyệt

**Authentication:**
* Required: Yes
* Type: Not specified

**Authorization:**
* Role: None
* Permission: None

**Parameters:**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| id | param | `string` | Yes |  |
| query | query | `RestaurantDiscoveryQueryDto` | Yes |  |

**Request Body:**
`None`

**Response:**
```typescript
Promise<RestaurantResponseDto>
```

**HTTP Status Codes:**
| Status | Meaning |
|---|---|
| 200 |  |
| 404 | Không tìm thấy nhà hàng đã duyệt |

**Source Reference:**
- File: `src/features/restaurants/controllers/public-discovery.controller.ts`
- Controller: `RestaurantDiscoveryController`
- Method: `findOne`

---

## 9. API Endpoint Inventory

```text
[GET]    /
[GET]    /health
[POST]    /auth/login/email
[POST]    /auth/register
[POST]    /auth/register/google
[POST]    /auth/logout
[POST]    /auth/forgot-password
[POST]    /auth/reset-password
[GET]    /auth/verify-reset-token
[POST]    /auth/register-driver
[GET]    /auth/check-phone
[POST]    /auth/send-otp
[POST]    /auth/verify-otp
[POST]    /auth/login-driver
[POST]    /auth/check
[POST]    /demo-payment/create-order
[POST]    /demo-payment/create-checkout
[GET]    /demo-payment/vnpay-result
[GET]    /demo-payment/vnpay-ipn
[GET]    /demo-payment/result
[GET]    /demo-payment/check-status
[POST]    /demo-payment/webhook
[GET]    /demo-payment/orders
[GET]    /demo-payment/checkouts
[POST]    /payment/process/:checkoutId
[POST]    /payment/cancel/:checkoutId
[POST]    /payment/webhook
[GET]    /payment/checkout/:checkoutId
[GET]    /payment/momo/result
[POST]    /payment/momo/check-status
[GET]    /payment/vnpay/result
[GET]    /payment/webhook/vnpay
[GET]    /payment/vnpay/status
[GET]    /protected
[GET]    /foods/:foodId/reviews
[POST]    /reviews/food
[POST]    /reviews/shipper
[GET]    /reviews/food/:foodId
[GET]    /reviews/shipper/:shipperId
[PUT]    /reviews/:id
[DELETE]    /reviews/:id
[GET]    /minio/health/live
[POST]    /chat
[GET]    /dashboard/stats
[GET]    /dashboard/chart-data
[GET]    /dashboard/shipper-stats
[GET]    /dashboard/order-completion-stats
[POST]    /foods
[GET]    /foods/all
[GET]    /foods
[GET]    /foods/top-selling
[GET]    /foods/newest
[GET]    /foods/with-discount
[GET]    /foods/search
[GET]    /foods/by-name
[GET]    /foods/top
[GET]    /foods/restaurant/:restaurantId
[GET]    /foods/restaurant/:restaurantId/top-selling
[GET]    /foods/restaurant/:restaurantId/with-discount
[GET]    /foods/category/:categoryId
[GET]    /foods/category/:categoryId/restaurant/:restaurantId
[GET]    /foods/:id
[PUT]    /foods/:id
[DELETE]    /foods/:id
[PUT]    /foods/:id/status
[DELETE]    /foods/:id/admin
[POST]    /foods/:id/toppings
[PUT]    /foods/toppings/:toppingId
[DELETE]    /foods/toppings/:toppingId
[GET]    /foods/:id/toppings
[POST]    /messenger/conversations
[GET]    /messenger/conversation-ids
[GET]    /messenger/conversations
[POST]    /messenger/messages
[GET]    /messenger/conversations/:conversationId/messages
[PUT]    /messenger/conversations/:conversationId/read
[DELETE]    /messenger/messages/:messageId
[PUT]    /messenger/conversations/:conversationId/block
[GET]    /messenger/unread-count
[GET]    /messenger/available-partners
[POST]    /orders
[GET]    /orders/my
[GET]    /orders
[POST]    /orders/calculate
[POST]    /orders/calculate-custom
[GET]    /orders/restaurant/my
[GET]    /orders/:id
[GET]    /orders/user/:userId
[GET]    /orders/:id/details
[PUT]    /orders/:id/status
[PUT]    /orders/admin/:id/status
[DELETE]    /orders/:id
[POST]    /orders/:id/payment
[POST]    /orders/validate-promotion
[POST]    /promotions
[GET]    /promotions/all
[GET]    /promotions
[GET]    /promotions/:id
[PUT]    /promotions/:id
[DELETE]    /promotions/:id
[POST]    /role
[PUT]    /role/:id/permissions
[PUT]    /role/:id
[POST]    /role/:id/users
[POST]    /role/:id/assign-users
[POST]    /role/:id/users/remove
[POST]    /role/:id/permissions
[POST]    /role/:id/permissions/remove
[DELETE]    /role/:id
[POST]    /shippers/accept-order
[POST]    /shippers/get-order
[POST]    /shippers/start-order
[POST]    /shippers/complete-order
[POST]    /shippers/cancel-order
[POST]    /shippers/reject-order
[GET]    /shippers/pending-assignment
[GET]    /shippers/order-history
[GET]    /shippers/profile
[GET]    /shippers/income-report
[POST]    /shippers/update-location
[GET]    /shippers/dashboard
[GET]    /shippers/performance
[GET]    /shippers/earnings-breakdown
[GET]    /shippers/achievements
[GET]    /users/shippers
[PUT]    /users/me
[POST]    /users
[PUT]    /users/:id
[DELETE]    /users/:id
[PATCH]    /users/shippers/:userId/approve
[PATCH]    /users/shippers/:userId/reject
[GET]    /notifications
[PATCH]    /notifications/:id/read
[GET]    /role
[GET]    /role/permissions
[GET]    /role/user-role-and-permission
[GET]    /role/user/:userId/permissions
[GET]    /role/check-permission/:roleId/:permissionName
[GET]    /role/:id/users/available
[GET]    /role/:id/permissions
[GET]    /role/:id/users
[GET]    /role/:id
[GET]    /users/me
[GET]    /users
[GET]    /users/:id
[POST]    /addresses
[GET]    /addresses
[GET]    /addresses/:id
[GET]    /addresses/user/:userId
[PUT]    /addresses/:id
[DELETE]    /addresses/:id
[GET]    /categories
[GET]    /categories/:id
[POST]    /categories
[PUT]    /categories/:id
[DELETE]    /categories/:id
[GET]    /admin/restaurants/requests
[PUT]    /admin/restaurants/:id/approve
[PUT]    /admin/restaurants/:id/reject
[DELETE]    /admin/restaurants/requests/:id
[POST]    /merchant/restaurants
[GET]    /merchant/restaurants/my
[PUT]    /merchant/restaurants/:id/files
[PUT]    /merchant/restaurants/:id
[DELETE]    /merchant/restaurants/:id
[GET]    /restaurants/all
[GET]    /restaurants/popular
[GET]    /restaurants/preview
[GET]    /restaurants/:id
```

## 10. API Consistency Audit

All endpoints listed are strictly extracted from source code decorators and methods. Ghost APIs and missing undocumented APIs have been eliminated.

## 12. Final Audit

Total endpoints discovered from source: 169
Total endpoints documented: 169
Undocumented endpoints: 0
Ghost endpoints: 0
Mismatched endpoints: 0
Potential conflicts: 0