import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// テスト用の Postgres（PGlite）を準備・初期化するための処理。
// 結合テスト（packages/api）と E2E（e2e/）の双方が使う。
//
// @repo/db 本体は読み込み時に DATABASE_URL を要求するため、DB を立ち上げる前に
// 使うこれらの処理は別エントリ（@repo/db/testing）として公開する。
// SQL の実行先は呼び出し側が渡し、このパッケージを PGlite や pg に依存させない。

// ソース（src/）からもビルド後（dist/src/）からも同じ場所を指せるよう、
// 相対パスではなく、上へたどって見つけた packages/db のルートを基準にする。
const findPackageRoot = (directory: string): string => {
    if (existsSync(join(directory, "package.json"))) {
        return directory;
    }
    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) {
        throw new Error("packages/db の package.json が見つかりません。");
    }
    return findPackageRoot(parentDirectory);
};

const migrationsDirectory = join(findPackageRoot(import.meta.dirname), "prisma/migrations");

// prisma/migrations の SQL を、名前順（= タイムスタンプ順 = 適用順）にすべて実行する。
export const applyMigrations = async (
    executeSql: (sql: string) => Promise<unknown>
): Promise<void> => {
    const entries = await readdir(migrationsDirectory, { withFileTypes: true });
    const migrationNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    for (const migrationName of migrationNames) {
        const migrationSql = await readFile(
            join(migrationsDirectory, migrationName, "migration.sql"),
            "utf8"
        );
        await executeSql(migrationSql);
    }
};

// 空にする対象（アプリのテーブル）の名前を取得する SQL。結果の列は tablename。
export const USER_TABLES_QUERY =
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename";

// 指定したテーブルをすべて空にし、RESTART IDENTITY で採番も 1 に戻す SQL を組み立てる。
export const buildTruncateAllTablesSql = (tableNames: readonly string[]): string =>
    `TRUNCATE ${tableNames.map((tableName) => `"public"."${tableName}"`).join(", ")} RESTART IDENTITY CASCADE`;
