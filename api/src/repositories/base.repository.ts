/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';


export abstract class BaseRepository<T, C = any, U = any> {
    constructor(protected prisma: PrismaClient, protected model: keyof PrismaClient) { }

    async findById(id: string): Promise<T | null> {
        return (this.prisma[this.model] as any).findUnique({ where: { id } });
    }

    async findAll(skip = 0, take = 20): Promise<T[]> {
        return (this.prisma[this.model] as any).findMany({ skip, take });
    }

    async create(data: C): Promise<T> {
        return (this.prisma[this.model] as any).create({ data });
    }

    async update(id: string, data: U): Promise<T> {
        return (this.prisma[this.model] as any).update({ where: { id }, data });
    }

    async delete(id: string): Promise<T> {
        return (this.prisma[this.model] as any).delete({ where: { id } });
    }
}
