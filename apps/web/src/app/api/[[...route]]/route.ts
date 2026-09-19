import { handle } from "hono/vercel";
import { app } from "@repo/api";

// packages/api と Next.js の唯一の接点（Epic #279）。ここに業務ロジックを
// 書かないこと。書いた瞬間に「Next.js に API を作った」形になり、
// packages/api を独立させている意味が失われる。
//
// これは apps/web から @repo/api への値 import である。ADR 0003 の不変条件は
// 「必ず import type」だったが、ADR 0006 決定 7 で「クライアント向けコードは
// 型のみ。route handler はサーバ専用なので値でよい」へ改めた。
const handler = handle(app);

// OPTIONS を export しないとブラウザからのリクエストが CORS で落ちる。
// Next.js の route handler は export したメソッドにしか応答せず、
// OPTIONS が無いと Next が自前で 204 を返す。その応答には Hono の cors() が
// 実行されないため Access-Control-* が付かず、ブラウザはプリフライトの
// 時点で止まり POST まで到達しない。
//
// フロントは api サブドメインを呼ぶためオリジンが異なり（ADR 0006 決定 2）、
// tRPC の mutation は Content-Type: application/json の POST なので
// プリフライトが必ず発生する。
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
