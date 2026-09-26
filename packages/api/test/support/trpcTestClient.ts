import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { signDoctorToken } from "@repo/auth";
import { doctorCookieName } from "@repo/schema";
import { app, type AppRouter } from "../../src/app.js";

// doctor.login が成功したときのレスポンス。
export const LOGIN_SUCCEEDED_RESPONSE = { message: "ログインに成功しました。" };

type TestClientOptions = {
    cookieHeader?: string;
    // Set-Cookie など、tRPC クライアントが返り値に含めないレスポンスの情報を検証するために使う。
    onResponse?: (response: Response) => void;
};

// web（apps/web/src/lib/trpc.ts）と同じ @trpc/client + superjson で API を呼ぶ。
// fetch を app.request に差し替えるため、ポートを開かずに
// Hono のミドルウェア（CORS → CSRF → tRPC）から DB までを通して検証できる。
// ホスト名は app.request が無視するため何でもよい。
export const createTestClient = ({ cookieHeader, onResponse }: TestClientOptions = {}) =>
    createTRPCClient<AppRouter>({
        links: [
            httpLink({
                url: "http://localhost/trpc",
                transformer: superjson,
                headers: cookieHeader ? { cookie: cookieHeader } : {},
                fetch: async (input, init) => {
                    const response = await app.request(input, init);
                    onResponse?.(response);
                    return response;
                },
            }),
        ],
    });

// tRPC クライアントは Set-Cookie を返り値に含めないため、レスポンスから読み取る手段を併せて返す。
// 書き換わる状態はこの関数の中に閉じ込め、呼び出し側は const で値を受け取れるようにする。
export const createSetCookieCapturingClient = () => {
    let lastSetCookieHeader: string | null = null;
    const client = createTestClient({
        onResponse: (response) => {
            lastSetCookieHeader = response.headers.get("set-cookie");
        },
    });
    return { client, readLastSetCookieHeader: (): string | null => lastSetCookieHeader };
};

// 本番と同じ signDoctorToken で JWT を発行し、ログイン済みの医師として呼ぶクライアントを返す。
// ログイン処理そのものの検証は authRouter.spec.ts で行う。
export const createDoctorClient = async (doctor: { id: number; email: string }) =>
    createTestClient({
        cookieHeader: `${doctorCookieName}=${await signDoctorToken(doctor.id, doctor.email)}`,
    });
