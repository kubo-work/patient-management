# ADR 0006: API を Vercel へ統合し、api サブドメインを維持したまま Render を撤収する

- 日付: 2026-09-06
- ステータス: 採用
- 関連: Issue #287 / Epic #279 / ADR 0002 / ADR 0003 / ADR 0004 / ADR 0005

## 背景

Epic #279 の主訴は Render 無料プランのアイドルスリープであり、初回リクエストに 50 秒以上かかる。#287 はこれを別ホストを持たないことで構造的に解消する。

### 現在の構成

| | ホスト | ドメイン |
|---|---|---|
| フロント | Vercel | `www.patient-management-kubo-works-projects.com` |
| API | Render | `api.patient-management-kubo-works-projects.com`（Render のサービスへ割り当てたカスタムドメイン） |
| DB | Neon | — |

**API は既に自分のドメインのサブドメインで運用されている。** この事実が本 ADR の判断の分岐点になった。

### Issue 本文と実態のズレ

#287 の本文は「同一オリジンになるため CORS 設定を削除」と書き、次のコードを示している。

```ts
import { handle } from "hono/vercel";
import { app } from "@repo/api";

export const GET = handle(app);
export const POST = handle(app);
```

着手時に確認したところ、**このコードはそのままでは動かない。**

`packages/api/package.json` の `exports` の `.` は `./build/index.js` を指しており、そのファイルは次の内容である。

```ts
import { serve } from "@hono/node-server";
import { app } from "./app.js";
serve({ fetch: app.fetch, port });
```

`app` を export していないため import は失敗する。仮に解決できたとしても、副作用として **Vercel Function の中で Node の HTTP サーバがポート 8080 に起動する**。

あわせて次を実測した。

| 項目 | 実測結果 |
|---|---|
| `hono/vercel` の `handle` | `(app) => (req) => app.fetch(req)` の 2 行。**パスの前置きを剥がさない** |
| `csrf()` の既定 | `(origin, c) => origin === new URL(c.req.url).origin`。同一オリジンなら options 不要 |
| `next.config` の rewrites | `has: [{ type: "host", value: "..." }]` によるホスト名マッチングに対応 |
| 静的エクスポート | Route Handlers は GET と `force-static` のみ対応。`Route Handlers that rely on Request` と `Proxy` は非対応機能として明記されている |

## 決定

### 1. Vercel プロジェクトは 1 つ、ドメインを 2 つ割り当てる

`www` と `api` の両方を同一の Next.js プロジェクトへ向け、`api` ホストからのリクエストを `next.config.mjs` の rewrite で `/api/*` へ流す。

```
api.patient-management-...com/trpc/*  →（rewrite）→  /api/trpc/*  →  route handler  →  Hono
```

`api` サブドメインは既に運用されているものであり、本決定はそれを**維持する**ものである。URL の構造はリポジトリを読まない相手にも構成を伝えるため、退役させる積極的な理由がない。

#### 同一オリジンに畳む案（`www.example.com/api/*` のみ）を採らなかった理由

技術的にはこれが最も単純である。CORS 設定そのものが存在しなくなり、設定ミスの余地が消え、Cookie も `Domain` 無しにできる。

しかしその代償は `api` サブドメインの退役である。既に運用しているものを、得るものが「設定の単純さ」だけのために捨てる判断にはならなかった。なお `packages/api` が Next.js を一切 import しない独立パッケージであることは、どちらの案でも変わらない。

#### API を別の Vercel プロジェクトとして分ける案を採らなかった理由

`packages/api` は Hono アプリであり Next.js アプリではない。Vercel へ単独で載せるには project root に `api/index.ts` 等のエントリを別途用意し、monorepo 向けのビルド設定も組む必要がある。**#287 が想定していた「3 行のマウント」では済まない新規作業が発生する。**

得られるものは 1 プロジェクト構成との比較で「デプロイ単位が分かれる」ことだけであり、URL の維持という目的は本決定で既に達成される。

### 2. フロントエンドは `api` サブドメインを呼ぶ

ブラウザからのリクエストは `www` ではなく `api.patient-management-...com` へ向かう。`NEXT_PUBLIC_API_URL` は残り、CORS も残る。

**Issue 本文の「フロントの API 参照を同一オリジンの相対パスへ変更」「CORS 設定を削除」は実施しない。** 決定 1 で `api` サブドメインを維持した以上、フロントが同一オリジン側を使うと、そのサブドメインは**アプリが一度も通らない装飾**になる。ネットワークタブに現れるのは `www.../api/trpc` であり、外から見て構成は伝わらない。さらに CORS 設定だけが「誰も通らない経路のために」残る——これは ADR 0005 決定 2 で lazy migration を退けた理由（使われない分岐は腐り、壊れてもテストが通り続ける）と同じ構図を自ら作ることになる。

代償は preflight である。tRPC の query は GET でクエリ文字列を使うため単純リクエストとなりプリフライトは発生しないが（`@trpc/client` の実装が `opts.contentTypeHeader && method !== "GET"` の条件で GET には `content-type` を付けないことを確認済み）、mutation は `Content-Type: application/json` の POST なのでプリフライトが発生する。`Access-Control-Max-Age` でキャッシュでき、#279 が問題にしている 50 秒とは桁が 4 つ違うため、天秤に載る規模ではない。

### 3. `@repo/api` の `exports` を `app.js` へ付け替える

背景で述べたとおり、現在の `.` は `build/index.js`（単独起動用）を指している。これを `build/app.js` へ変える。

```json
"main": "./build/app.js",
"types": "./build/app.d.ts",
"exports": {
  ".": { "types": "./build/app.d.ts", "default": "./build/app.js" },
  "./package.json": "./package.json"
}
```

`types` が `build/trpc/appRouter.d.ts` を指さなくなるため、`app.ts` に `export type { AppRouter } from "./trpc/appRouter.js";` を足し、`apps/web/src/lib/trpc.ts` の型 import が従来どおり動くようにする。

`src/index.ts` は削除せず残す。`start` スクリプトの対象であり、#279 が求める「起動ファイルを 1 つ足せば独立サーバになる」状態そのものである。export しないことで、Vercel 経路から誤って読み込まれる余地を無くす。

### 4. パスの前置きは両方にマウントして吸収し、実測後に絞る

`hono/vercel` の `handle` はパスを剥がさない。したがって Hono が受け取るパスは、route handler へ届く `request.url` がどう見えるかに依存する。

**Next の rewrite を経由したとき `request.url` が `/api/trpc/...` と `/trpc/...` のどちらになるかは、実測しないと確定できない。** rewrite は内部的な経路の付け替えであり、`Request` に見えるパスが書き換え前か書き換え後かはランタイムの実装次第である。

そこで、どちらでも動く形を採る。

```ts
const apiRoutes = new Hono()
    .use("*", cors({ ... }))
    .use("*", csrf({ origin: accessClientUrl }))
    .use("/trpc/*", trpcServer({ ... }));

export const app = new Hono().route("/", apiRoutes).route("/api", apiRoutes);
```

単独起動時（`/trpc/*`）と Vercel の route handler 経由（`/api/trpc/*`）の双方が同じ結果になる。既存テストの `app.request("/trpc/...")` も変更なしで通る。

**実装の最初のステップで実際の `request.url` を計測する。片方だけで足りると分かった時点でマウントを 1 つに絞り、本 ADR を更新する。**

#### `basePath("/api")` 単独を採らなかった理由

`request.url` が書き換え前のパスを返す場合に 404 になる。実測前にこちらへ倒すと、失敗したときの切り分けが「Vercel 上でしか再現しない 404」になる。

#### route handler で `Request` を作り直してパスを書き換える案を採らなかった理由

`new Request(url, request)` によるボディ付きリクエストの複製は、Node のランタイムで `duplex` の扱いに依存する落とし穴がある。3 行で済むはずの箇所に、環境依存の不具合を持ち込む余地を作らない。

### 5. Cookie の `SameSite` を `None` から `Lax` へ変える

`SameSite` はオリジンではなく**サイト（eTLD+1）**で判定される。`www.patient-management-...com` と `api.patient-management-...com` は eTLD+1 が同一のため **same-site** であり、`Lax` でも Cookie は送信される。

`domain`（`SERVER_DOMAIN`）は維持する。`www` 側の `proxy.ts` が Cookie を読んで画面遷移を判定するため（ADR 0004 決定 4）、`api` ホスト限定の host-only Cookie では読めない。

**これは本 ADR で最も実質的なセキュリティ上の改善である。** `None` はクロスサイト送信を許す最も弱い設定であり、CSRF 耐性をブラウザ側の既定防御に頼れなくなる。Render（`onrender.com`）が呼び出し先だった時代には cross-site だったため `None` 以外に選択肢がなかったが、`api` サブドメインへ移った時点で不要になっていた。

#### 検討中の誤りの記録

設計の議論中、「現在の構成ではサードパーティ Cookie 制限により Safari でログインできない可能性が高い」と述べたが、これは誤りだった。呼び出し先を `onrender.com` と読み違えたことによる。実際の呼び出し先は自分のドメインのサブドメインであり same-site のため、サードパーティ Cookie 制限の対象にならない。**現状の構成が Safari で壊れているという主張は取り下げる。**

### 6. `DEPLOY_TARGET=aws` は明示的に throw する

route handler の追加により、`output: "export"` 構成でのビルドは正常に通らなくなる。背景で挙げたとおり、静的エクスポートは `Request` に依存する Route Handlers と `Proxy` を非対応機能として明記している。

`next.config.mjs` の `isAwsDeploy` 分岐で、次のメッセージとともに読み込み時に throw する。

> 静的エクスポート（DEPLOY_TARGET=aws）は #287 以降サポートしない。`infra/` の扱いは #293 で判断する。

`deploy-frontend.yml` は `workflow_dispatch` のみで発火するため、CI が赤くなることはない。失敗するのは手動実行したときだけである。

#### 分岐と `deploy-frontend.yml` を今回削除する案を採らなかった理由

死んだ設定が消えて最もきれいだが、**#279 と #293 が「`infra/` の扱いは移行完了後に判断する」と明示的に先送りした判断を前倒しすることになる。** #293 は判断が必要な論点をメモとして保持しており、そこへ材料が揃う前に決める理由がない。

#### 何もせず壊れるに任せる案を採らなかった理由

Next の内部エラーが出た際、それが「AWS 構成は #287 以降サポートされない」という意図的な帰結なのか、単なるバグなのかを読み取れない。ADR 0004 決定 3 で「設定漏れは読み込み時点で落とす」を選んだのと同じ理由で、失敗の仕方を決定的にする。

### 7. ADR 0003 の不変条件を改訂する

ADR 0003 の波及は次を定めていた。

> `apps/web` からの `@repo/api` の参照は必ず `import type` にする。

route handler は `apps/web` に置かれ、Hono の `app` を**値として** import する。上記の文言のままでは抵触する。

不変条件を次へ改める。

> `apps/web` の**クライアント向けコード**からの `@repo/api` の参照は必ず `import type` にする。route handler（`app/api/**/route.ts`）はサーバ専用であり、値として import してよい。

守るべき実体は「Prisma をブラウザ向けバンドルへ引きずり込まない」ことであり、route handler はサーバでのみ実行されるためこれに反しない。検出手段も変わらない——クライアントコンポーネントが値で import すれば `bun run build:web` が失敗する。

なお ADR 0004 決定 2 で確認したとおり、この不変条件は依然として**規約のみで守られており機械的な強制がない**。別 Issue として起票済みの課題である。

### 8. ローカル開発は 8080 の単独起動を維持する

フロントは `NEXT_PUBLIC_API_URL=http://localhost:8080` を見る。`localhost:3000` と `localhost:8080` は別オリジンであるため、**CORS が本番と同じくローカルでも実行される。**

代償として、この経路では route handler が一度も通らない。そのため `localhost:3000/api/trpc/*` へ直接リクエストして疎通を確認する手順を検証に含める。決定 4 の実測もここで行う。

## 波及

- **`NEXT_PUBLIC_API_URL` と `CLIENT_URL` は残る。** #287 の本文が削除を想定していた 2 つだが、決定 2 により引き続き必要である
- **`next.config.mjs` の `headers()` による CORS ヘッダを削除する。** `api` サブドメイン側で Hono が CORS を返すため、Next 側の設定は重複であり、片方だけ更新される事故の元になる
- **`@repo/api` の `types` エントリが変わる。** `apps/web/src/lib/trpc.ts` の `import type { AppRouter } from "@repo/api"` は、`app.ts` からの型再 export により従来どおり解決する
- **単独起動時のパスが増える。** 決定 4 の二重マウントにより、`node build/index.js` で起動したサーバは `/trpc/*` と `/api/trpc/*` の両方に応答する。実測後にどちらかへ絞る
- **`api` サブドメインの DNS 向き先を Render から Vercel へ変更する必要がある。** これはコードの変更では完結しない運用作業である
- **本 ADR のコードだけでは #287 は閉じない。** 完了条件の 3 つ（プレビュー環境で全機能が動作する / Render を停止してもアプリが動作する / 初回アクセスが 1 秒未満）はいずれも実環境での確認を要求する
- **本番切り替えは #313 の決着後に行う。** 切り替え時に本番データを一括ハッシュ化する（ADR 0005 決定 2・7）ため、パスワード復旧経路が未定のまま実行すると #313 が警告している状態を作る

## スコープ外

- **`infra/`（AWS）の扱い。** 決定 6 のとおり #293 へ委ねる
- **`packages/api` → Next.js の import を機械的に禁止する仕組み。** 決定 7 で触れたが本 ADR の主旨と無関係であり、別 Issue として起票済み
- **tRPC クライアントのバッチ設定（#307）。** データ取得層は #292 の担当
