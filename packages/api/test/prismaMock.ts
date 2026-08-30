// PrismaClient は型としてしか使わない。@repo/db 自体をモックするため、
// 値として import すると実行時に undefined になる。必ず import type にする。
import type { PrismaClient } from "@repo/db";
import { prisma } from "@repo/db";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended"


beforeEach(() => {
    mockReset(prismaMock)
})

// クライアントの生成が packages/db に移ったため、モック対象も @repo/db になる。
// ただしモジュール全体を置き換えると、同じモジュールから import している
// Prisma や delFlag まで undefined になる。@repo/db 本体を requireActual すると
// PrismaClient の生成まで走ってしまうため、値を持つ生成物だけを実物として取り込む。
jest.mock('@repo/db', () => {
    const generatedClient = jest.requireActual("../../db/dist/generated/client/client.js");
    return {
        __esModule: true,
        ...generatedClient,
        prisma: mockDeep<PrismaClient>(),
    };
})

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
