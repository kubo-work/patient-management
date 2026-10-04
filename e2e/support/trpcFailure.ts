import type { Page } from "@playwright/test";

// 取得の失敗、応答の遅れ、タブへ戻ったときの再取得を、画面の外から再現する。

const TRPC_PATH_MARKER = "/trpc/";

// JSON-RPC のエラー番号。tRPC は BAD_REQUEST をこの値で返す。
const BAD_REQUEST_JSON_RPC_CODE = -32600;
// バッチの中に成功と失敗が混ざるときに tRPC が返す HTTP ステータス。
const MULTI_STATUS = 207;

// 画面が表示する文言とは別の文言にする。同じにすると、画面がこの message を
// そのまま表示しているだけでも、文言を探すテストが通ってしまう。
const INJECTED_ERROR_MESSAGE = "テスト用に失敗させた応答";

// API が取得の失敗で返すのと同じ形のエラー（superjson を通しているため json で包む）。
const toBadRequestResult = (procedurePath: string) => ({
    error: {
        json: {
            message: INJECTED_ERROR_MESSAGE,
            code: BAD_REQUEST_JSON_RPC_CODE,
            data: { code: "BAD_REQUEST", httpStatus: 400, path: procedurePath },
        },
    },
});

// httpBatchLink は同時に発火した取得を 1 本にまとめ、URL に procedure 名をカンマ区切りで並べる。
const readProcedurePaths = (requestUrl: string): string[] => {
    const { pathname } = new URL(requestUrl);
    const procedurePathsStart = pathname.indexOf(TRPC_PATH_MARKER) + TRPC_PATH_MARKER.length;
    return pathname.slice(procedurePathsStart).split(",");
};

// 以降、指定した procedure の取得だけを失敗させる。
// 同じバッチに入った他の取得は、実際の API の応答をそのまま返す。
export const failTrpcQuery = async (page: Page, procedurePath: string): Promise<void> => {
    await page.route(`**${TRPC_PATH_MARKER}**`, async (route) => {
        const procedurePaths = readProcedurePaths(route.request().url());
        if (!procedurePaths.includes(procedurePath)) {
            await route.continue();
            return;
        }
        const response = await route.fetch();
        const results: unknown[] = await response.json();
        await route.fulfill({
            status: MULTI_STATUS,
            contentType: "application/json",
            body: JSON.stringify(
                procedurePaths.map((path, index) =>
                    path === procedurePath ? toBadRequestResult(path) : results[index]
                )
            ),
        });
    });
};

// 以降、指定した procedure を含むリクエストを、指定した時間だけ遅らせてから API へ送る。
// 保存中の画面の状態を確かめるために使う。
export const delayTrpcRequest = async (
    page: Page,
    procedurePath: string,
    delayMilliseconds: number
): Promise<void> => {
    await page.route(`**${TRPC_PATH_MARKER}**`, async (route) => {
        if (readProcedurePaths(route.request().url()).includes(procedurePath)) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, delayMilliseconds);
            });
        }
        await route.continue();
    });
};

// 別のタブから戻ってきたときと同じく、表示中の取得を取り直させ、その応答が画面に反映されるまで待つ。
// ヘッダーが表示しているログイン中の医師は必ず取り直されるため、その応答を目印にする。
//
// これを使うテストは「取り直しの後も画面が変わらないこと」を確かめる。待ちが足りないと、
// 不具合があっても画面が変わる前に確認が済み、テストが通ってしまう（見逃す側へ倒れる）。
// 応答の後に描画 2 回分を待てば足りることは、不具合のあるコードでテストが失敗することで確かめた。
// 遅い環境で見逃しが疑われるときは、ここの待ちを伸ばす。
export const returnToTab = async (page: Page): Promise<void> => {
    const refetchResponse = page.waitForResponse((response) =>
        response.url().includes("doctor.loginDoctor")
    );
    await page.evaluate(() => {
        window.dispatchEvent(new Event("visibilitychange"));
    });
    await (await refetchResponse).finished();
    // 応答を受けた後の再描画が済むまで待つ。
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            })
    );
};
