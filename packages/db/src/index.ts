import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.ts";

// Prisma 7 では Rust クエリエンジンが廃止され、DB との通信はドライバアダプタが担う。
// PrismaPg は node-postgres の薄いラッパーで、標準的な Postgres の TCP 接続を使う。
// Neon（pooled）にも AWS RDS にも同じコードで接続できるため、
// infra/ の AWS 復帰経路を維持できる。
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export * from "../generated/client/client.ts";
