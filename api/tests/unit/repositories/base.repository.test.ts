import { BaseRepository } from '../../../src/repositories/base.repository';
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// Concrete implementation for testing
class TestRepository extends BaseRepository<any, any, any> {
    constructor(prisma: PrismaClient) {
        // 'user' is a valid model in the schema
        super(prisma, 'user' as keyof PrismaClient);
    }
}

describe('BaseRepository', () => {
    let repository: TestRepository;
    let prismaMock: DeepMockProxy<PrismaClient>;

    beforeEach(() => {
        prismaMock = mockDeep<PrismaClient>();
        repository = new TestRepository(prismaMock);
    });

    describe('findById', () => {
        it('should find item by id', async () => {
            const mockItem = { id: '1', name: 'Test' };
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockItem);

            const result = await repository.findById('1');
            expect(result).toEqual(mockItem);
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
        });

        it('should return null if not found', async () => {
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

            const result = await repository.findById('999');
            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should return all items', async () => {
            const mockItems = [{ id: '1' }, { id: '2' }];
            (prismaMock.user.findMany as jest.Mock).mockResolvedValue(mockItems);

            const result = await repository.findAll();
            expect(result).toEqual(mockItems);
            expect(prismaMock.user.findMany).toHaveBeenCalledWith({ skip: 0, take: 20 });
        });

        it('should support pagination', async () => {
            const mockItems = [{ id: '3' }];
            (prismaMock.user.findMany as jest.Mock).mockResolvedValue(mockItems);

            const result = await repository.findAll(10, 5);
            expect(result).toEqual(mockItems);
            expect(prismaMock.user.findMany).toHaveBeenCalledWith({ skip: 10, take: 5 });
        });
    });

    describe('create', () => {
        it('should create an item', async () => {
            const newItem = { name: 'New' };
            const createdItem = { id: '1', ...newItem };
            (prismaMock.user.create as jest.Mock).mockResolvedValue(createdItem);

            const result = await repository.create(newItem);
            expect(result).toEqual(createdItem);
            expect(prismaMock.user.create).toHaveBeenCalledWith({ data: newItem });
        });
    });

    describe('update', () => {
        it('should update an item', async () => {
            const updateData = { name: 'Updated' };
            const updatedItem = { id: '1', ...updateData };
            (prismaMock.user.update as jest.Mock).mockResolvedValue(updatedItem);

            const result = await repository.update('1', updateData);
            expect(result).toEqual(updatedItem);
            expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: updateData });
        });
    });

    describe('delete', () => {
        it('should delete an item', async () => {
            const deletedItem = { id: '1', name: 'Deleted' };
            (prismaMock.user.delete as jest.Mock).mockResolvedValue(deletedItem);

            const result = await repository.delete('1');
            expect(result).toEqual(deletedItem);
            expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
        });
    });
});
