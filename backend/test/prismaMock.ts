import { PrismaClient } from "@prisma/client";
import { mockDeep } from "jest-mock-extended"

const prismaMock = mockDeep<PrismaClient>();

jest.mock('../src/prisma', () => ({
    __esModule: true,
    prisma: prismaMock,
}))

export { prismaMock }
