import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "@repo/db/migrations";
import type { TestProject } from "vitest/node";

// 結合テスト（api-integration project）の globalSetup。実行全体で 1 回だけ、
// マイグレーションを適用済みの PGlite を作ってデータディレクトリをダンプする。
// 各テストファイルの setupFiles（pgliteDatabase.ts）はこのダンプから復元する。
//
// 時間の大半は PGlite.create() の初期化（initdb 相当）で、1 回約 800ms かかる。
// マイグレーションの適用は約 20ms、ダンプからの復元は約 150ms。
// テストファイルごとに初期化すると、ファイル数に比例して setup が重くなる。
//
// ダンプは約 40MB あるため、provide で値として渡さず、一時ファイルのパスだけを渡す。

declare module "vitest" {
    export interface ProvidedContext {
        pgliteTemplatePath: string;
    }
}

const createTemplateDump = async (): Promise<Blob> => {
    const database = await PGlite.create();
    try {
        await applyMigrations((sql) => database.exec(sql));
        // 圧縮すると復元のたびに展開が要るため、"none" で保存する。
        return await database.dumpDataDir("none");
    } finally {
        await database.close();
    }
};

const setup = async (project: TestProject): Promise<() => Promise<void>> => {
    const templateDump = await createTemplateDump();
    const templateDirectory = await mkdtemp(join(tmpdir(), "pglite-template-"));
    const templatePath = join(templateDirectory, "template.tar");
    await writeFile(templatePath, new Uint8Array(await templateDump.arrayBuffer()));
    project.provide("pgliteTemplatePath", templatePath);

    return async () => {
        await rm(templateDirectory, { recursive: true, force: true });
    };
};

export default setup;
