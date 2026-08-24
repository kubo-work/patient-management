import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended"

import { prisma } from "../src/prisma.js"


beforeEach(() => {
    mockReset(prismaMock)
})

jest.mock('../src/prisma.js', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}))

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
