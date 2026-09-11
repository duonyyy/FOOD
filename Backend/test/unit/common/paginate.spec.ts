import { paginate } from 'src/common/pagination/paginate';
import { SelectQueryBuilder } from 'typeorm';

describe('paginate helper', () => {
  it('should paginate items with correct calculations', async () => {
    const mockItems = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];
    const totalCount = 25;

    const mockQueryBuilder = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockItems, totalCount]),
    } as unknown as SelectQueryBuilder<any>;

    const result = await paginate(mockQueryBuilder, 2, 10);

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      items: mockItems,
      totalItems: 25,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
  });

  it('should fallback to safe values when invalid page or pageSize are passed', async () => {
    const mockQueryBuilder = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    } as unknown as SelectQueryBuilder<any>;

    const result = await paginate(mockQueryBuilder, -5, 500);

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    expect(result.totalPages).toBe(0);
  });
});
