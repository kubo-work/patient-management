import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: { path: "prisma/migrations" },
    // env() ヘルパーは設定ファイルの読み込み時に即座に解決を試みるため、
    // DIRECT_URL が未設定だと接続を必要としない prisma generate まで失敗する。
    // CI と Docker のビルドでは環境変数が無い状態で generate が走るので、
    // 未設定でも読み込みが通る process.env の直接参照を使う。
    datasource: { url: process.env.DIRECT_URL ?? "" },
});
