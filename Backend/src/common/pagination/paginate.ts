import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Helper phân trang chuẩn hóa cho TypeORM QueryBuilder.
 * Tự động tính toán skip, take và totalPages.
 */
export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  pageSize: number = 10,
): Promise<PaginatedResult<T>> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Math.min(100, Number(pageSize) || 10));

  queryBuilder.skip((safePage - 1) * safeSize).take(safeSize);
  const [items, totalItems] = await queryBuilder.getManyAndCount();

  return {
    items,
    totalItems,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.ceil(totalItems / safeSize),
  };
}
