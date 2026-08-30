// PrismaClient は型としてしか使わない。@repo/db 自体をモックするため、
// 値として import すると実行時に undefined になる。必ず import type にする。
import type { PrismaClient } from "@repo/db";
import { prisma } from "@repo/db";
import { beforeEach, vi } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";

// vi.mock はファイル先頭へ巻き上げられるため、ファクトリの外側で作った値を
// 参照できない。ファクトリを async にして、その中で import する。
//
// モジュール全体を置き換えると、同じモジュールから import している
// Prisma や delFlag まで undefined になる。@repo/db 本体を importActual すると
// PrismaClient の生成（および DATABASE_URL 未設定時の throw）まで走ってしまうため、
// 値を持つ生成物だけを実物として取り込む。
vi.mock("@repo/db", async () => {
    const { mockDeep } = await import("vitest-mock-extended");
    const generatedClient = await vi.importActual<Record<string, unknown>>(
        "../../db/dist/generated/client/client.js"
    );
    return {
        ...generatedClient,
        prisma: mockDeep(),
    };
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
    mockReset(prismaMock);
});
