export const CATEGORY_READER = Symbol('CATEGORY_READER');

export interface CategoryReaderPort {
  findCategoryById(categoryId: string): Promise<CategorySnapshot | null>;
}

export interface CategorySnapshot {
  categoryId: string;
  name: string | null;
  image: string | null;
  foodCount: number;
}
