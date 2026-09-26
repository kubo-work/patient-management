// E2E のサーバ（scripts/startTestServer.ts）とテスト（Playwright）が共有する定数。
// どちらも別プロセスで動くため、接続先はここで固定値として揃える。
// 開発用の next dev（3000）や compose の Postgres（5432）と衝突しない番号にしている。

export const APP_PORT = 3100;
export const DATABASE_PORT = 54329;

export const APP_ORIGIN = `http://localhost:${APP_PORT}`;
export const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${DATABASE_PORT}/postgres`;

// 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
export const JWT_SECRET_KEY = "e2e-only-secret-key-not-used-in-any-environment";
