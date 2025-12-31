import { PrismaClient } from '@prisma/client';

export abstract class BaseRepository<T> {
    // @ts-ignore
    constructor(protected prisma: PrismaClient, protected model: keyof PrismaClient) { }

    async findById(id: string): Promise<T | null> {
        // @ts-ignore
        return this.prisma[this.model].findUnique({ where: { id } });
    }

    async findAll(skip = 0, take = 20): Promise<T[]> {
        // @ts-ignore
        return this.prisma[this.model].findMany({ skip, take });
    }

    async create(data: any): Promise<T> {
        // @ts-ignore
        return this.prisma[this.model].create({ data });
    }

    async update(id: string, data: any): Promise<T> {
        // @ts-ignore
        return this.prisma[this.model].update({ where: { id }, data });
    }

    async delete(id: string): Promise<T> {
        // @ts-ignore
        return this.prisma[this.model].delete({ where: { id } });
    }
}
