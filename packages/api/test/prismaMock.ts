// PrismaClient は型としてしか使わない。@repo/db 自体をモックするため、
// 値として import すると実行時に undefined になる。必ず import type にする。
import type { PrismaClient } from "@repo/db";
import { prisma } from "@repo/db";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended"


beforeEach(() => {
    mockReset(prismaMock)
})

// クライアントの生成が packages/db に移ったため、モック対象も @repo/db になる。
jest.mock('@repo/db', () => ({
    __esModule: true,
    prisma: mockDeep<PrismaClient>(),
}))

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
