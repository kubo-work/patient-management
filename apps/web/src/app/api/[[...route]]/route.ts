import { handle } from "hono/vercel";
import { app } from "@repo/api";

// packages/api と Next.js の唯一の接点（Epic #279）。ここに業務ロジックを
// 書かないこと。書いた瞬間に「Next.js に API を作った」形になり、
// packages/api を独立させている意味が失われる。
//
// これは apps/web から @repo/api への値 import である。ADR 0003 の不変条件は
// 「必ず import type」だったが、ADR 0006 決定 7 で「クライアント向けコードは
// 型のみ。route handler はサーバ専用なので値でよい」へ改めた。
export const GET = handle(app);
export const POST = handle(app);
