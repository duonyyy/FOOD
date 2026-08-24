-- Test seed for the Foodee backend.
-- Run this after your TypeORM migrations have created the schema.
-- PostgreSQL example:
--   psql "$DATABASE_URL" -f database/test-seed.sql

BEGIN;

INSERT INTO "permissions" ("id", "name", "description", "is_active")
VALUES
  ('11111111-1111-4111-8111-111111111111', 'manage_orders', 'Create and manage orders', true),
  ('22222222-2222-4222-8222-222222222222', 'manage_restaurants', 'Create and manage restaurants', true),
  ('33333333-3333-4333-8333-333333333333', 'deliver_orders', 'Accept and deliver orders', true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "roles" ("id", "name", "display_name", "description", "is_system")
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'Customer', 'Default customer role', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'shop_owner', 'Shop Owner', 'Restaurant owner role', true),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'shipper', 'Shipper', 'Delivery staff role', true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333')
ON CONFLICT DO NOTHING;

INSERT INTO "users" (
  "id", "username", "password", "email", "role_id", "name", "phone",
  "avatar", "is_active", "birthday", "authProvider",
  "completedDeliveries", "failedDeliveries", "activeDeliveries",
  "averageRating", "totalRatings", "averageDeliveryTime",
  "onTimeDeliveries", "lateDeliveries", "rejectedOrders",
  "responseTimeMinutes", "totalEarnings", "monthlyEarnings",
  "weeklyEarnings", "dailyEarnings"
)
VALUES
  (
    'usr_customer_test_001', 'customer_test', '$2a$10$2IwVtoO1/d8idJK21fsIweWnRiNiYrtlOD5F.KiowLX.RCsE1F4V2', 'customer@test.local',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test Customer', '0900000001',
    'https://example.com/customer.png', true, '1999-01-01', 'email',
    0, 0, 0, 5.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ),
  (
    'usr_owner_test_001', 'owner_test', '$2a$10$2IwVtoO1/d8idJK21fsIweWnRiNiYrtlOD5F.KiowLX.RCsE1F4V2', 'owner@test.local',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Test Shop Owner', '0900000002',
    'https://example.com/owner.png', true, '1995-05-05', 'email',
    0, 0, 0, 5.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ),
  (
    'usr_shipper_test_001', 'shipper_test', '$2a$10$2IwVtoO1/d8idJK21fsIweWnRiNiYrtlOD5F.KiowLX.RCsE1F4V2', 'shipper@test.local',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Test Shipper', '0900000003',
    'https://example.com/shipper.png', true, '1997-07-07', 'email',
    12, 1, 1, 4.8, 10, 24, 11, 1, 0, 3, 350000, 120000, 70000, 20000
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "address" (
  "id", "street", "ward", "district", "city", "latitude", "longitude",
  "userId", "isDefault", "label", "isTemporary"
)
VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '1 Vo Van Ngan', 'Linh Chieu',
    'Thu Duc', 'Ho Chi Minh City', 10.850600, 106.771900,
    'usr_customer_test_001', true, 'Home', false
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '2 Han Thuyen', 'Linh Trung',
    'Thu Duc', 'Ho Chi Minh City', 10.870000, 106.803000,
    'usr_owner_test_001', true, 'Restaurant address', false
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "shipperCertificateInfos" ("id", "user_id", "cccd", "driverLicense", "status", "verifiedAt")
VALUES
  (
    '12121212-1212-4121-8121-121212121212', 'usr_shipper_test_001',
    '079000000001', 'GPLX-TEST-001', 'APPROVED', NOW()
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "restaurants" (
  "id", "name", "phoneNumber", "backgroundImage", "addressId", "avatar",
  "description", "openTime", "closeTime", "licenseCode", "certificateImage",
  "rating", "status", "latitude", "longitude", "owner_id"
)
VALUES
  (
    '99999999-9999-4999-8999-999999999999', 'UIT Test Kitchen', '0280000000',
    'https://example.com/restaurant-bg.png', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'https://example.com/restaurant-avatar.png', 'Seed restaurant for backend testing',
    '08:00', '22:00', 'LIC-TEST-001', 'https://example.com/license.png',
    4.70, 'approved', 10.8700000, 106.8030000, 'usr_owner_test_001'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "categories" ("id", "name", "image")
VALUES
  ('44444444-4444-4444-8444-444444444444', 'Rice', 'https://example.com/rice.png'),
  ('55555555-5555-4555-8555-555555555555', 'Drinks', 'https://example.com/drinks.png')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "foods" (
  "id", "description", "image", "image_urls", "name", "price",
  "discount_percent", "sold_count", "rating", "purchased_number",
  "category_id", "status", "tag", "preparation_time", "restaurant_id"
)
VALUES
  (
    '66666666-6666-4666-8666-666666666666', 'Broken rice with grilled pork',
    'https://example.com/com-tam.png', 'https://example.com/com-tam-1.png,https://example.com/com-tam-2.png',
    'Com tam suon bi cha', 55000.00, 10.00, 20, 4.60, 20,
    '44444444-4444-4444-8444-444444444444', 'available', 'best_seller', 15,
    '99999999-9999-4999-8999-999999999999'
  ),
  (
    '77777777-7777-4777-8777-777777777777', 'Iced milk coffee',
    'https://example.com/coffee.png', 'https://example.com/coffee-1.png',
    'Ca phe sua da', 25000.00, 0.00, 15, 4.80, 15,
    '55555555-5555-4555-8555-555555555555', 'available', 'drink', 5,
    '99999999-9999-4999-8999-999999999999'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "toppings" ("id", "name", "price", "isAvailable", "food_id")
VALUES
  ('88888888-8888-4888-8888-888888888888', 'Extra egg', 8000.00, true, '66666666-6666-4666-8666-666666666666'),
  ('abababab-abab-4aba-8aba-abababababab', 'Extra pork skin', 10000.00, true, '66666666-6666-4666-8666-666666666666')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "promotions" (
  "id", "description", "type", "discountPercent", "discountAmount",
  "minOrderValue", "maxDiscountAmount", "image", "code",
  "start_date", "end_date", "number_of_used", "max_usage"
)
VALUES
  (
    '10101010-1010-4101-8101-101010101010', '10 percent off for test orders',
    'FOOD_DISCOUNT', 10, NULL, 50000.00, 30000.00,
    'https://example.com/promo.png', 'TEST10',
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', 0, 100
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "orders" (
  "id", "user_id", "restaurant_id", "total", "note", "status",
  "promotion_id", "date", "address_id", "paymentMethod", "paymentDate",
  "isPaid", "deliveryDistance", "estimatedDeliveryTime", "deliveryType",
  "requestedDeliveryTime", "shippingFee", "shipperEarnings", "shipperCommissionRate"
)
VALUES
  (
    '20202020-2020-4202-8202-202020202020', 'usr_customer_test_001',
    '99999999-9999-4999-8999-999999999999', 80500,
    'Please add extra fish sauce', 'confirmed',
    '10101010-1010-4101-8101-101010101010', TO_CHAR(NOW(), 'YYYY-MM-DD'),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'COD', NULL,
    false, 4.5, 30, 'asap', NULL, 15000, 12000, 0.8
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "orderDetails" (
  "id", "order_id", "food_id", "varity", "quantity", "price",
  "note", "selected_toppings", "topping_total"
)
VALUES
  (
    '30303030-3030-4303-8303-303030303030',
    '20202020-2020-4202-8202-202020202020',
    '66666666-6666-4666-8666-666666666666',
    'regular', 1, '55000', 'Less rice',
    '[{"id":"88888888-8888-4888-8888-888888888888","name":"Extra egg","price":8000}]',
    8000.00
  ),
  (
    '31313131-3131-4313-8313-313131313131',
    '20202020-2020-4202-8202-202020202020',
    '77777777-7777-4777-8777-777777777777',
    'regular', 1, '25000', NULL, NULL, 0.00
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "shippingDetails" (
  "id", "status", "user_id", "order_id", "estimatedDeliveryTime",
  "actualDeliveryTime", "trackingNumber"
)
VALUES
  (
    '40404040-4040-4404-8404-404040404040', 'SHIPPING',
    'usr_shipper_test_001', '20202020-2020-4202-8202-202020202020',
    NOW() + INTERVAL '30 minutes', NULL, 'TRK-TEST-001'
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "orders"
SET "shippingDetail_id" = '40404040-4040-4404-8404-404040404040'
WHERE "id" = '20202020-2020-4202-8202-202020202020'
  AND "shippingDetail_id" IS NULL;

INSERT INTO "checkouts" (
  "id", "userId", "orderId", "amount", "paymentMethod",
  "paymentIntentId", "paymentUrl", "status", "paymentDetails"
)
VALUES
  (
    '50505050-5050-4505-8505-505050505050',
    'usr_customer_test_001', '20202020-2020-4202-8202-202020202020',
    80500.00, 'COD', NULL, NULL, 'PENDING',
    '{"source":"seed","environment":"local"}'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "reviews" ("id", "user_id", "food_id", "image", "comment", "rating", "type", "shipper_id")
VALUES
  (
    '60606060-6060-4606-8606-606060606060',
    'usr_customer_test_001', '66666666-6666-4666-8666-666666666666',
    NULL, 'Good test food', 5, 'food', NULL
  ),
  (
    '61616161-6161-4616-8616-616161616161',
    'usr_customer_test_001', NULL,
    NULL, 'Fast test delivery', 5, 'shipper', 'usr_shipper_test_001'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "conversations" (
  "id", "participant1_id", "participant2_id", "lastMessage",
  "lastMessageAt", "isBlocked", "blockedBy", "conversationType",
  "orderId", "restaurantId"
)
VALUES
  (
    '70707070-7070-4707-8707-707070707070',
    'usr_customer_test_001', 'usr_owner_test_001',
    'Hello, is my order being prepared?', NOW(), false, NULL,
    'customer_shop', '20202020-2020-4202-8202-202020202020',
    '99999999-9999-4999-8999-999999999999'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "messages" (
  "id", "conversation_id", "sender_id", "content", "messageType",
  "attachmentUrl", "attachmentType", "isRead", "readAt", "isEdited",
  "editedAt", "isDeleted", "deletedAt", "metadata", "replyToMessageId"
)
VALUES
  (
    '80808080-8080-4808-8808-808080808080',
    '70707070-7070-4707-8707-707070707070',
    'usr_customer_test_001', 'Hello, is my order being prepared?',
    'text', NULL, NULL, false, NULL, false, NULL, false, NULL,
    '{"orderId":"20202020-2020-4202-8202-202020202020"}', NULL
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "notifications" ("id", "description", "content", "receiveUser", "isRead", "type")
VALUES
  (
    '90909090-9090-4909-8909-909090909090',
    'Order confirmed', 'Your test order has been confirmed.',
    'usr_customer_test_001', false, 'ORDER'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "pending_shipper_assignments" (
  "id", "order_id", "priority", "attemptCount", "lastAttemptAt",
  "nextAttemptAt", "notes", "isSentToShipper"
)
VALUES
  (
    'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
    '20202020-2020-4202-8202-202020202020',
    2, 1, NOW(), NOW() + INTERVAL '5 minutes',
    'Seed assignment for testing shipper flow', true
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "system_constraints" (
  "id", "min_completion_rate", "min_total_orders", "max_active_deliveries",
  "max_delivery_distance", "min_shipper_rating", "max_delivery_time_min",
  "base_distance_km", "base_shipping_fee", "tier2_distance_km",
  "tier2_shipping_fee", "tier3_shipping_fee"
)
VALUES
  (1, 0.7, 10, 3, 30, 3.5, 45, 5, 15000, 10, 25000, 35000)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
