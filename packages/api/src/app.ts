import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/appRouter.js";
import { createTrpcContext } from "./trpc/context.js";

// apps/web は `import type { AppRouter } from "@repo/api"` で型を参照する。
// exports の "." が app.js を指すようになったため、ここから再 export する
// （ADR 0006 決定 3）。
export type { AppRouter } from "./trpc/appRouter.js";

// CORS の許可オリジン。未設定のまま起動すると Access-Control-Allow-Origin が
// ワイルドカードになり、credentials: true と組み合わさってブラウザ側で必ず拒否される。
// 失敗が初回リクエストまで表面化しないため、@repo/db の DATABASE_URL と同様に
// 読み込み時点で落とす。
//
// Vercel 統合後も CORS は残る。フロントは api サブドメインを呼び続けるため
// オリジンが異なる（ADR 0006 決定 2）。
const accessClientUrl = process.env.CLIENT_URL;
if (!accessClientUrl) {
    throw new Error(
        "CLIENT_URL が設定されていません。CORS の許可オリジンをこの環境変数から解決します。"
    );
}

const apiRoutes = new Hono()
    .use(
        "*",
        cors({
            origin: accessClientUrl,
            credentials: true,
            allowHeaders: [
                "Content-Type",
                "Authorization",
                "Accept",
                "X-Requested-With",
                "Access-Control-Allow-Credentials",
            ],
        })
    )
    // Hono の context.req.json() は Content-Type を検査せず本文を JSON として解釈する。
    // Express の express.json() は application/json 以外を弾いていたため、
    // プリフライトが発生しない text/plain のクロスサイト POST は本文が空のまま
    // 検証で落ちていた。その障壁が移行で消えるので、Origin を検査する正式な防御を置く。
    .use("*", csrf({ origin: accessClientUrl }))
    // REST から tRPC への移行が完了し（ADR 0003 決定 4）、残るアプリケーションの
    // RPC はすべて tRPC が担う。token_check は参照が無いため移植せず削除した
    // （ADR 0003 決定 7）。
    .use(
        "/trpc/*",
        trpcServer({
            router: appRouter,
            createContext: (_opts, honoContext) => createTrpcContext(honoContext),
        })
    );

// listen はここでは行わない。Node で起動する経路は index.ts、
// Vercel へ載せる経路は apps/web の route handler がそれぞれ担う。
// この分離が「1 つのホストへ畳む」選択を不可逆にしないための境界になる。
//
// 同じルート群を 2 箇所へマウントするのは、hono/vercel の handle が
// パスの前置きを剥がさないためである（ADR 0006 決定 4）。単独起動時は
// /trpc/*、Vercel の route handler 経由では /api/trpc/* で届く。
// rewrite 経由でどちらのパスが見えるかは Vercel 上でしか計測できないため、
// 計測が済むまで両方を受ける。
export const app = new Hono().route("/", apiRoutes).route("/api", apiRoutes);
