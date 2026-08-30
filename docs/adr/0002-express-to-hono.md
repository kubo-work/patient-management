# ADR 0002: HTTP レイヤを Express から Hono へ置き換える

- 日付: 2026-08-30
- ステータス: 採用
- 関連: Issue #284 / Epic #279

## 背景

`packages/api` は Express 4 の上に構築されている。Express は Node の `http` に密結合しているため、Vercel Functions / Cloudflare Workers / Deno にそのままでは載らない。#287 で API を Vercel へ統合する前提では、この密結合が直接の障害になる。

採用の動機は「Express が古いから」ではなく、**ホスト非依存にすること**である。Hono は Web 標準の `Request` / `Response` の上に構築されており、Node / Bun / Vercel / Cloudflare / Deno のすべてで同一コードが動く。次にホスティングへ不満が出たときに、同じ規模の書き直しを繰り返さないための投資として位置づける。

移行前のコードには、Express 固有の事情から生じた問題が 3 つあった。

1. `verifyAuthToken` が `(request, response, next)` に縛られ、`request.user` を `declare module "express"` の declaration merging で後付けしていた。型が「全リクエストで optional」になるため、認可を通ったハンドラでも `if (!request.user)` の到達不能なガードが必要になっていた
2. `login.ts` がログイン成功のたびに `app.use(cors(...))` を呼び、リクエストごとにミドルウェア配列が伸び続けていた
3. テストが `supertest` 経由で実際にポートを listen するため、`index.ts` に `NODE_ENV !== 'test'` の分岐が必要だった

## 決定

### 1. `app.ts`（定義）と `index.ts`（listen）を分離する

`app.ts` は Hono インスタンスを組み立てて export するだけで、listen しない。`index.ts` は `@hono/node-server` の `serve()` を呼ぶだけにする。

現状の `index.ts` は app の定義と listen を 1 ファイルで行い、`NODE_ENV !== 'test'` で listen を握り潰している。テストが環境変数に依存する原因がこれである。分離すれば、テストは `app.ts` を import するだけで listen 経路に一切触れない。

この分離は #287 でも効く。`apps/web/src/app/api/[[...route]]/route.ts` は `app` を import して `handle(app)` を返すだけになり、Render 用の `index.ts` は独立サーバの起動ファイルとしてそのまま残せる。**「Vercel に 1 つへ畳む」選択を不可逆にしない**ことが分離の目的である。

### 2. 認可は `createMiddleware` の `Variables` で型を伝播させる

```ts
export type DoctorAuthVariables = {
    doctorId: number;
};

export const requireDoctor = createMiddleware<{ Variables: DoctorAuthVariables }>(...);
```

各ルータを `new Hono<{ Variables: DoctorAuthVariables }>()` で生成することで、`context.get("doctorId")` が `number` として推論される。declaration merging による `Request` の拡張は不要になり、`verifyAuthToken.ts` は `middleware/requireDoctor.ts` へ置き換わる。

`login_doctor.ts` の `if (!request.user)` ガードは、ミドルウェアを通った時点で必ず値があるため元々一度も実行されていない。型で保証されるようになるので削除する。レスポンスの差分にはならない。

### 3. `express-session` と `connect-pg-simple` を本 Issue で同時に削除する

Issue #284 の当初案は `express` / `cors` / `cookie-parser` のみを削除し、`express-session` は #286 へ残す想定だった。**これは成立しない。** `express-session` は `(req, res, next)` と `req.session` に依存した Express 専用ミドルウェアであり、Hono には載らない。Express を外す以上、同時に外れる。

機能への影響はない。`SessionData` の `sessionId` / `userId` に**値を書き込むコードがリポジトリ内に 1 行も存在せず**、認証は JWT Cookie 側で完結している。`logout.ts` の `session.destroy()` は常に空のセッションを破棄していただけで、レスポンス（`"ログアウトしました。"`）は変わらない。

これに伴い `pg` も `packages/api` の直接依存から外れる。`connect-pg-simple` のセッションストアのためだけに入っていたもので、DB 接続は `@repo/db` が `@prisma/adapter-pg` 経由で持つ。

#286 の残りスコープは「Cookie 属性の見直しと JWT 有効期限の整理」に縮小する。

### 4. テストランナーを Jest から Vitest へ移す

`jest.config.ts` は TypeScript 7 では読み込めない。7 系はコンパイラがネイティブ実装へ置き換わり、JS 版の Compiler API（`typescript/lib/typescript.js`）が撤廃されたため、それに依存する `ts-jest` / `ts-node` が jest 起動時の設定パース段階で落ちる。結果として API のテストは 1 本も実行できない状態にある。

Hono 移行の完了条件は「全エンドポイントが従来と同じレスポンスを返すこと」であり、これを検証する手段が他にない。したがって #288（Vitest + PGlite）のうち **Vitest 部分だけを本 Issue へ前倒しする**。Vitest は esbuild でトランスパイルし TypeScript の Compiler API を使わないため、TypeScript 7 でも動く。

PGlite による実 DB テストと、テスト設計そのものの立て直しは #288 に残す。

移植時に緑にならない既存テスト（モックの未設定に依存しているもの、Cookie ではなく `Authorization` ヘッダを送っているもの）は、期待値を実挙動に合わせて書き換えず、`.skip` と理由コメントを付けて #288 へ申し送る。Hono 移植の正しさをテストの書き換えで覆い隠さないためである。

### 5. `CLIENT_URL` の未設定を起動時エラーにする

現状の `cors({ origin: undefined })` は `Access-Control-Allow-Origin: *` を返す。`credentials: true` と組み合わせるとブラウザは必ず拒否するが、原因は初回リクエストまで表面化しない。`@repo/db` が `DATABASE_URL` に対して既に同じ扱い（未設定なら読み込み時に throw）をしているため、そのパターンへ揃える。

### 6. `app.options('*', cors())` を削除する

`hono/cors` はプリフライトを自身で処理するため不要。この記法は Express 5 の path-to-regexp では例外になるパターンでもあり、移植先に持ち込む理由がない。

### 7. `PUT /doctor/doctors/:doctor_id` に認可を追加する

**本 ADR で唯一、振る舞いを変える箇所である。**

`src/doctor/doctors.ts` の PUT だけ `verifyAuthToken` が付いていなかった。同ファイルの GET / POST には付いている。このエンドポイントは `password` を更新できるため、トークン無しで任意の医師のパスワードを既知の値へ書き換えられる。ログインは `findFirst({ where: { AND: [{ email }, { password }] } })` の平文一致であるため、書き換えた値でそのままログインできる。情報の改竄ではなくアカウントの乗っ取りが成立する。

移植の対象ファイルを全面的に書き換える以上、既知の乗っ取り経路を意図的に温存して次のフェーズへ送る理由がない。「振る舞いを変えない」は移植の正しさを検証可能に保つための手段であり、脆弱性を残す根拠ではない。

回帰の恐れは無い。`apps/web/src/app/hooks/useDoctorEdit.ts` はこの PUT に `credentials: "include"` を付けており、同じフックの POST は既に認可を必要とする。ログイン済みでなければ到達できない画面のため、認可を追加してもフロントエンドの挙動は変わらない。既存のテストにこのエンドポイント向けの認可テストは存在しないため、期待値の書き換えも発生しない。

なお、本番が固定されているコミット（`c912a01`）にも同じ穴がある。Render は `render-legacy` に固定されており `main` の変更は本番へ届かないため、**本 Issue の変更だけでは本番の穴は塞がらない**。本番側の対応は #287（Vercel 統合）または個別の hotfix で扱う。

平文パスワードの保存と比較そのものは本 ADR の範囲外とする。

## 検討して採用しなかった案

### `bun:test` を Vitest と併用する

`packages/api` は DOM を必要としないため `bun test` でも動くが、採用しない。

- **本番と異なるランタイムでテストすることになる。** #279 で「本番ランタイムは Node（Vercel Functions）、bun はインストールとスクリプト実行まで」と確定している。`bun test` は bun ランタイム上で走るため、Prisma 7 + `@prisma/adapter-pg`（node-postgres の TCP 接続）が bun 上で Node と同じ挙動をするかという別の検証課題を抱える
- **モックの流儀が二重化する。** `bun:test` の `mock.module()` と Vitest の `vi.mock()` は別物で、`mockDeep<PrismaClient>()` を提供する `vitest-mock-extended` は Vitest 前提である。`test/prismaMock.ts` にあたる基盤を 2 通り保守することになり、#288 で PGlite を入れる際に二重の書き換えが発生する
- **併用の利点が残らない。** bun:test の主な利点は速度だが、`app.request()` への移行で supertest の listen が消えるため、実行時間の支配項が先に消える

なお `app.request()` を使うテスト本体はランナー非依存である。Vitest 固有なのは `describe` / `expect` / モックのみで、後から `bun:test` や `node:test` へ乗り換える自由は残る。今から両方を維持する必要はない。

### Express を残したまま Hono をサブアプリとして mount する

段階移行は可能だが、`express` の依存が残るため本 Issue の完了条件（Express 関連の依存がすべて削除されている）を満たさない。エンドポイントが 14 と小規模で、一度に移せる規模であるため採用しない。

### この機会に tRPC 化まで進める

#285 のスコープ。Hono（HTTP レイヤ）と tRPC（RPC レイヤ）は競合せず重ねて使うものであり、同時に行うと差分が「ホスト非依存化」と「API 設計の変更」の 2 種類混ざって追いにくくなる。本 Issue は**振る舞いを変えない移植**に限定する。

## 波及

- `verifyAuthToken.ts` が `middleware/requireDoctor.ts` へ置き換わる。`declare module "express"` による `Request` の拡張が消える
- `index.ts` から `NODE_ENV !== 'test'` の分岐が消える。テストは `app.ts` を import する
- ルート `package.json` の `overrides: { "@types/express": "^4.17.21" }` が不要になる
- `tsconfig.test.json` の `types` から `jest` / `supertest` が外れる
- `jest.config.ts` が `vitest.config.ts` に置き換わり、`ts-node` の依存が外れる（`tsx` は `nodemon` が使うため残る）
- `POST` のリクエストボディが空の場合、Express の `express.json()` は `{}` を渡すが、Hono の `context.req.json()` は例外を投げる。各ハンドラの `try` / `catch` が受けるため応答は 400 のままだが、エラーの発生箇所は変わる
- Hono はパスを厳密に一致させるため、Express が許容していた末尾スラッシュ（`/doctor/doctors/`）は 404 になる。`apps/web` の API 呼び出しに末尾スラッシュを付けている箇所は無いことを確認済み
- Render の起動コマンド（`node build/index.js`）は変わらない。`@hono/node-server` が listen を担う
- `PUT /doctor/doctors/:doctor_id` がトークンを要求するようになる。フロントエンドは既に Cookie を送っているため画面の挙動は変わらないが、この 1 本だけレスポンスが変わる（Cookie 無しの場合 200 → 401）
- `POST /doctor/logout` の `Content-Type` が `text/html; charset=utf-8` から `text/plain; charset=UTF-8` に変わる。Express の `res.send(文字列)` と Hono の `context.text()` の既定の違いによる。本文とステータスは同一で、唯一の消費者（`apps/web/src/app/hooks/useDoctorLogout.ts`）は本文を読まない
- リクエストボディが空、または JSON として不正な場合のエラーメッセージが 3 箇所で変わる。`express.json()` は `req.body` に必ず `{}` を立てたためハンドラ自身の検証分岐へ到達したが、`context.req.json()` は例外を投げて `catch` に落ちる。`POST /doctor/login` は「メールアドレスが入力されていません。」が「ログインに失敗しました。」に、`POST /doctor/doctors` は「入力データが不正です。」が「データの保存に失敗しました。」に、`PUT /doctor/doctors/:doctor_id` は「データの更新に失敗しました。」になる。**ステータスコードは全ケース 400 のまま**で、フロントエンドは常に妥当な JSON を送るため到達しない経路である。`context.req.json().catch(() => ({}))` でメッセージを揃えることもできるが、不正な JSON を黙って握り潰すことになるため採用しない
- 末尾スラッシュ付きのパス（`/doctor/logout/` など）が 404 になる。Express の `app.use(prefix, router)` は両方に一致したが、Hono の `route()` は完全一致のみ。`apps/web` の API 呼び出しに末尾スラッシュを付けている箇所が無いことを確認済み
- `app.set('trust proxy', 1)` / `cookieParser()` / `express.json()` / `optionsSuccessStatus: 200` が消える。いずれも Express 固有の配管で消費者が残っていない。Cookie の `secure` 属性は `req.secure` ではなく `NODE_ENV` から直接決めているため、`trust proxy` の消失は本番の Cookie 発行に影響しない
