import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// テスト用の Postgres（PGlite）へ、prisma/migrations の SQL をそのまま適用する。
// 結合テスト（packages/api）と E2E（e2e/）の双方が使う。
//
// @repo/db 本体は読み込み時に DATABASE_URL を要求するため、DB を立ち上げる前に
// 使うこの処理は別エントリ（@repo/db/migrations）として公開する。
// 実行先は SQL を受け取る関数で渡し、このパッケージを PGlite に依存させない。

// ビルド後は dist/src/migrations.js から実行されるため、パッケージ直下の prisma/ を指す。
const migrationsDirectory = join(import.meta.dirname, "../../prisma/migrations");

export const applyMigrations = async (
    executeSql: (sql: string) => Promise<unknown>
): Promise<void> => {
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
        await executeSql(migrationSql);
    }
};
