import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
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

const migrationsDirectory = join(import.meta.dirname, "../../../db/prisma/migrations");

const applyMigrations = async (database: PGlite): Promise<void> => {
    const entries = await readdir(migrationsDirectory, { withFileTypes: true });
    // Prisma のマイグレーションディレクトリ名はタイムスタンプ始まりのため、名前順が適用順になる。
    const migrationNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    for (const migrationName of migrationNames) {
        const migrationSql = await readFile(
            join(migrationsDirectory, migrationName, "migration.sql"),
            "utf8"
        );
        await database.exec(migrationSql);
    }
};

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
    const database = await PGlite.create();
    await applyMigrations(database);
    // 圧縮すると復元のたびに展開が要るため、"none" で保存する。
    const templateDump = await database.dumpDataDir("none");
    await database.close();

    const templateDirectory = await mkdtemp(join(tmpdir(), "pglite-template-"));
    const templatePath = join(templateDirectory, "template.tar");
    await writeFile(templatePath, new Uint8Array(await templateDump.arrayBuffer()));
    project.provide("pgliteTemplatePath", templatePath);

    return async () => {
        await rm(templateDirectory, { recursive: true, force: true });
    };
}
