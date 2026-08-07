export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationInput {
  page: number;
  limit: number;
  total: number;
}

export function createPaginatedResponse<T>(
  data: T[],
  { page, limit, total }: PaginationInput,
): PaginatedResponse<T> {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('Pagination page must be a positive integer.');
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Pagination limit must be a positive integer.');
  }

  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError('Pagination total must be a non-negative integer.');
  }

  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}
