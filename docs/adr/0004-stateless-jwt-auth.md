# ADR 0004: express-session を廃止し JWT + httpOnly Cookie でステートレス化する

- 日付: 2026-09-02
- ステータス: 採用
- 関連: Issue #286 / Epic #279 / ADR 0002 / ADR 0003

## 背景

Issue #286 が挙げた 5 項目のうち 3 項目は、#284（Express → Hono）と #285（tRPC 化）を進める過程で既に達成されていた。着手時点の実測は次のとおりである。

| Issue #286 の項目 | 着手時点の状態 |
|---|---|
| 署名付き JWT を httpOnly Cookie へ格納する | 完了。ただしライブラリは `jose` ではなく `jsonwebtoken` |
| `requireDoctor` で JWT を検証し `doctorId` を context に載せる | 完了。`protectedProcedure`（`trpc/init.ts`）が担う |
| `express-session` / `connect-pg-simple` / `pg` を依存から削除 | 完了。`package.json` にも `bun.lock` にも残っていない |
| Prisma スキーマから `session` モデルを削除する | 未対応 |
| `apps/web/src/proxy.ts` に JWT 検証を追加する | 未対応 |

ステートレス化そのものは #284 / #285 の副産物として先に完了していた。本 ADR が扱うのは、残る 2 項目と、その 2 項目を実装しようとして初めて表面化した設計上の選択である。

表面化した選択は 1 点に集約される。**`proxy.ts` で JWT を検証するには、`apps/web` 側にも検証手段が要る。** 検証コードをどのライブラリで書き、どのパッケージ境界に置き、秘密鍵が無いときにどう振る舞うか——本 ADR の決定はすべてここから派生する。

なお検討の当初は「`jsonwebtoken` は Node の `crypto` に依存するため Edge ランタイムの proxy では動かない」ことを制約として挙げていたが、実装時に Next.js 同梱のドキュメント（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`）で確認したところ **Next.js 16 の proxy は Node ランタイムが既定**であり、この制約は成立しなかった。`jsonwebtoken` を `apps/web` へ持ち込む選択も技術的には可能である。決定 1 の根拠はランタイムではなく、署名側と検証側が別ライブラリに分かれることの検出不能性と、`packages/api` をホスト非依存に保つことの 2 点にある。

### `proxy.ts` に検証が無いことの実害

現行の `proxy.ts` は Cookie の有無だけを見ている。

```
proxy.ts:12  Cookie が無く /doctor/login 以外  → /doctor/login へ
proxy.ts:15  Cookie が有り /doctor/login      → /doctor/patients-list へ
```

期限切れの Cookie を持つ利用者はここでデッドロックする。`/doctor/login` を開こうとしても Cookie があるため `patients-list` へ飛ばされ、`patients-list` では tRPC が `FORBIDDEN` を返す（`trpc/init.ts`）。**ログインし直す画面へ到達できない。** JWT 検証の追加は、認可を厳しくする変更である以前に、この不具合の修正である。

## 決定

### 1. `jsonwebtoken` を `jose` へ全面置換する

`jose`（6.2.10、2026-08-21 公開）を採用し、`jsonwebtoken` と `@types/jsonwebtoken` を依存から外す。`jose` は Web Crypto 上に構築されており、Node / Edge / Workers のいずれでも同一コードが動く。ADR 0002 が Hono を選んだ理由——ホスト非依存——と同じ基準である。

署名アルゴリズムは HS256 で据え置く。`jsonwebtoken` のデフォルトと同一のため、発行済みのトークンはそのまま検証を通り、強制ログアウトは発生しない。

代償として `verifyDoctorToken` / `signDoctorToken` が非同期になり、`createTrpcContext` も `async` になる。tRPC の `createContext` は Promise を受け付けるため、変更は機械的である。

**API 側だけ `jsonwebtoken` を残し web 側だけ `jose` を使う案は採らない。** 署名側と検証側が別ライブラリになると、アルゴリズムやペイロード仕様の食い違いを型でもテストでも検出できない。この非対称を恒久的に抱えるコストは、非同期化のコストより高い。

### 2. 検証コードは新パッケージ `@repo/auth` に置く

`packages/auth` を新設し、`signDoctorToken` / `verifyDoctorToken` / `DoctorTokenResult` と秘密鍵の解決を収める。`@repo/api` と `apps/web` の両方がこれに依存する。このパッケージは Prisma も Hono も Next.js も import しない。

置き場所として次の 2 つを検討し、退けた。

**`@repo/schema` の直下は不可能である。** `GlobalDoctorContext.tsx` や各 hooks がクライアントコンポーネントから `@repo/schema` を import しているため、バレルへ検証コードを足すと `jose` がブラウザバンドルに載る。

**`@repo/api` のサブパス export（`@repo/api/auth`）は採らない。** 新パッケージは不要になるが、ADR 0003 が記録した不変条件——「`apps/web` からの `@repo/api` の参照は必ず `import type` にする」——が「型のみ、ただし `@repo/api/auth` は値でも可」という条件付きに変わる。ADR 0003 自身が「`import` と書き間違えた瞬間に壊れる」と警告した箇所であり、そこへ例外を作ることになる。

この判断には前提がある。着手時に確認したところ、`packages/api` から `next` は解決できてしまう。

```
next 解決先: <repo>/node_modules/next/package.json
```

bun workspaces が `next` をルートの `node_modules` へ巻き上げるため、`packages/api` に `next/server` を import しても TypeScript もビルドも止めない。**依存の向きを守っているのは規約であって、機械的な強制ではない。** 一方向（`apps/web` → `@repo/api` の値 import）だけが Prisma のバンドル失敗として偶然検出される、という非対称な状態にある。

規律で守るしかない領域では、条件付きのルールより単純なルールのほうが保たれる。「`@repo/api` からは常に型のみ」は覚えていられるが、「型のみ、ただしこのサブパスは例外」は数ヶ月後に破られ、しかも破っても何も落ちない。パッケージを 1 つ増やすほうが安い。

なお #287 で Vercel へ統合されデプロイ単位が 1 つになっても、この境界は不要にならない。Next の proxy は独立したバンドルとしてビルドされるため、そこから `@repo/api` を値で import すれば Prisma が proxy のバンドルへ引きずり込まれる。デプロイ先の数と依存の向きは別の問題である。

### 3. 秘密鍵の欠落は読み込み時に throw する

`@repo/auth` は `JWT_SECRET_KEY` が読めなければモジュールの読み込み時点で例外を投げる。

```ts
const rawSecret = process.env.JWT_SECRET_KEY;
if (!rawSecret) {
    throw new Error("JWT_SECRET_KEY が設定されていません。医師トークンの署名と検証に使用します。");
}
```

このリポジトリは同じ問題に対して既に 2 度この答えを出している。`packages/api/src/app.ts` の `CLIENT_URL` と `@repo/db` の `DATABASE_URL` である。app.ts のコメントが理由を書いている——「失敗が初回リクエストまで表面化しない」ため読み込み時点で落とす。3 度目に別の答えを出す理由がない。

退けた案は 2 つある。**fail-closed**（検証できなければログイン画面へ送る）は 500 を避けられるが、全利用者がログイン画面から動けない状態になり、原因がどこにも出力されない。**fail-open**（Cookie の有無だけで判定する現行の挙動へ縮退する）はアプリを壊さず、認可の権威は `protectedProcedure` にあるためセキュリティホールにもならない。しかし「検証しているつもりで検証していない」状態に誰も気づけない。どちらも「壊れていることが分からない壊れ方」である。

#### 波及: `DoctorTokenResult` から `reason` が消える

`secret-missing` が到達不能になるため、残る失敗は `invalid` だけになる。判別共用体の意味がなくなるので `{ ok: true; doctorId: number } | { ok: false }` に畳む。

これに伴い `protectedProcedure` の分岐が 3 つから 2 つになる。ADR 0003 決定 1 が「認可の 3 分岐を型で保つ」と書いた `secret-missing`（401、Cookie 削除つき）の枝が消え、`deleteCookie` の呼び出しも `trpc/init.ts` から消える。Cookie 無し（401）と検証失敗（403）の使い分けは変わらない。既存テストがこの枝を検証していないため、テストの損失はない。

### 4. `proxy.ts` で JWT を検証し、Cookie ヘッダの手動解析をやめる

```ts
const token = req.cookies.get(doctorCookieName)?.value;
const isAuthenticated = token ? (await verifyDoctorToken(token)).ok : false;
```

現行の `cookieHeader?.split("; ").find(...)?.split("=")[1]` を `req.cookies.get()` に置き換える。あわせて `proxy.ts:9` の「httpOnly のクッキーは取得できないので注意」というコメントを削除する。サーバ側では httpOnly Cookie は読めるため、この記述は誤りである。

認可の権威は引き続き `protectedProcedure` にある。proxy が担うのは画面遷移の判定であり、tRPC の検証を代替するものではない。

### 5. `proxy.ts` では期限切れ Cookie を削除しない

検証に失敗したとき、proxy はリダイレクトするだけで Cookie を消さない。

本番の Cookie は API 側が `domain: SERVER_DOMAIN` 付きで発行している（`doctor_cookie.ts`）。web 側から属性の異なる削除を出しても、ブラウザは別の Cookie とみなし削除は効かない。効かない処理を「削除している」という見た目のために置くことはしない。

背景で述べたデッドロックは、検証を入れた時点で解消する。期限切れであれば `isAuthenticated` が偽になり、`/doctor/login` へ到達できるからである。Cookie は再ログイン時に上書きされる。

### 6. `session` テーブルの本番削除は #293 へ委ねる

`schema.prisma` から `session` モデルを削除し、`DROP TABLE "session";` のマイグレーションを追加する。**適用はローカル DB にのみ行い、本番（Neon）へは適用しない。**

本番は `render-legacy` に固定されており、そのコードは今も `connect-pg-simple` を使っている。

```
origin/render-legacy:backend/src/index.ts:57   tableName: "session",
origin/render-legacy:backend/package.json:46   "express-session": "^1.18.0",
```

`express-session` はリクエストのたびにこのテーブルへ触るため、Neon から `session` を落とすと本番は全リクエストで落ちる。#287 が未完了で Render の代替が存在しない以上、いま適用する選択肢は無い。

自動適用の経路が無いことは確認済みである。`main.yml` は `workflow_dispatch` のみで発火し、`migrate deploy` を含むのは停止中の ECS 向け `start:aws` スクリプトだけである。マイグレーションは本番で未適用のまま pending として積まれる。

移行期間中は `schema.prisma` と本番 DB がズレる。Render 撤収まで解消できない性質のズレであるため、隠さずここに記録し、#293 のチェックリストへ「Neon へ `session` 削除マイグレーションを適用する（Render 停止後）」を追加する。

Issue #286 の完了条件「DB に `session` テーブルが存在しない」は、本 Issue ではローカル基準で満たしたものとする。

## 検討して採用しなかった案

### `iron-session` を採用する

Cookie の暗号化まで面倒を見るライブラリだが、現状は既に JWT で動作しており、置き換えて得られるものが「Issue 本文に名前が書かれている」以外に見当たらない。#284 / #285 が組んだ認可の 3 分岐を作り直す差分だけが残る。

### `session` モデルの削除ごと #293 へ送る

本 Issue の差分は `packages/auth` と `proxy.ts` だけになり単純化するが、Issue #286 の完了条件を 2 つ落とす。またモデルだけを先に外してマイグレーションを書かない形は、`prisma migrate dev` が drift を検出する状態を作るため危険である。

### 本 Issue の中で本番へマイグレーションを適用する

完了条件を文字どおり満たすが、代替の無い状態で本番が停止する。

### `packages/api` → Next.js の import を機械的に禁止する仕組みを本 Issue で入れる

決定 2 で判明した「規約のみで守られている」状態は実在する課題だが、本 Issue の主旨と無関係であり、`lint` スクリプトの適用範囲（現状 `apps/web` のみ）に手を入れることになる。別 Issue として起票する。

## 波及

- **`packages/auth` がワークスペースの 4 つ目のパッケージになる。** ルートの `build` / `typecheck` / `dev` / `test` スクリプトと、`apps/web` の `build` スクリプトのビルド順に配線が必要になる
- **`apps/web` に `JWT_SECRET_KEY` の設定が必要になる。** #287 で Vercel へ統合されれば環境変数 1 箇所で web と API の両方へ届くため、この二重管理は移行期間中に限られる
- **`apps/web/.env` の `NEXT_DOCTOR_SESSION_SECURE` と `NEXT_JWT_SECRET_KEY` はどこからも参照されていない。** 前者は express-session 時代の残骸であり、後者は今回追加する `JWT_SECRET_KEY` とは別物である。本 Issue の主旨に照らして削除する
- **`packages/api/vitest.config.ts` の `env` に `JWT_SECRET_KEY` のダミー値を追加する。** 現状このファイルは `CLIENT_URL` と `DATABASE_URL` を明示する一方 `JWT_SECRET_KEY` は `.env.test` 頼りで、既存テストは `secretKey ? sign(...) : ""` と欠損を許容する形で書かれている。決定 3 により欠損が許容されなくなるため、同ファイルが既に宣言している方針（「テストを環境ファイルに依存させない」）に従って値を明示する
- **CI は落ちない。** `type-check.yml` は `bun run typecheck` のみを実行し、テストを走らせない。`tsc` はモジュールを実行しないため、決定 3 の throw が CI に影響することはない
- **`verifyDoctorToken` に `Number.isInteger` の検査を足す。** 現行の `auth/token.ts` は `Number(decoded.userId)` を無検査で返しており、`userId` を持たないトークンでは `doctorId` が `NaN` のまま通過する。自前の鍵で署名されたトークンでしか起きず攻撃経路ではないが、書き直す箇所であるため同時に直す
- **`doctor_cookie.ts` の冒頭コメントを修正する。** 決定 3 により `trpc/init.ts` からの参照が消え、「発行と削除の両方を行う `router/auth.ts` と、削除のみを行う `trpc/init.ts` の 2 箇所が参照する」という記述が事実と食い違う
- **`packages/api/test/auth/token.spec.ts` は `packages/auth` へ移す。** テストは実装と同じパッケージに置く。`packages/auth` に vitest の設定が要る
- **`packages/api/test/trpc/authorization.spec.ts` のトークン生成が `jose` になる。** 検証している 401 / 403 の分岐そのものは変わらない
- **パスワードの平文保存には触れない。** ADR 0002 の残課題として据え置く
- **`doctorCookieName` は `@repo/schema` に残す。** クライアントコンポーネント（`GlobalDoctorLoginContext.tsx`）が参照しており、`@repo/auth` へ動かす利益がない
