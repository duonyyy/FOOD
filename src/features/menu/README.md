# menu

Owner đích: Food/MenuItem, Category, Topping, availability và menu pricing hiện hành. Category
vertical slice đã chuyển vào `src/features/menu/categories`; Food command/query hiện được bind trong
Catalog composition và giữ `src/modules/food` làm compatibility HTTP shell.

T2.3 exports `MenuReaderPort`; T3.1 bổ sung `CategoryReaderPort`. T4.3 bind
`FoodCommandService`/`FoodQueryService`, merchant ownership policy, storage/cache ports và chuyển
review query về Reviews. T4.4 tách `ToppingCommandService` với duplicate/name/price rules. T4.5 giữ
owner/admin policy ở Catalog/Merchant boundary. T4.6 triển khai `MenuReaderService` trả
`OrderableItemSnapshot` immutable cho Ordering; không truyền TypeORM entity qua public contract.
