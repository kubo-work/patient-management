import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.ts";

// Prisma 7 では Rust クエリエンジンが廃止され、DB との通信はドライバアダプタが担う。
// PrismaPg は node-postgres の薄いラッパーで、標準的な Postgres の TCP 接続を使う。
// Neon（pooled）にも AWS RDS にも同じコードで接続できるため、
// infra/ の AWS 復帰経路を維持できる。
// connectionString を渡さないと node-postgres は PGHOST などの環境変数や
// localhost の既定値にフォールバックし、意図しない DB に繋がる。
// また接続の失敗は初回クエリまで表面化しないため、起動時に落とす。
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error(
        "DATABASE_URL が設定されていません。@repo/db は接続先をこの環境変数から解決します。"
    );
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

export * from "../generated/client/client.ts";
