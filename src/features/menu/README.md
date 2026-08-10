# menu

Owner đích: Food, Category, Topping, availability và menu pricing hiện hành. Category vertical slice đã chuyển vào `src/features/menu/categories`; Food/Topping vẫn compatibility implementation tại `src/modules/food`.

T2.3 exports `MenuReaderPort`; T3.1 bổ sung `CategoryReaderPort`. T4.3–T4.6 sẽ bind adapter và chuyển Food/Topping vertical slices. Orders nhận snapshot qua public contract, không nhận TypeORM entity.
