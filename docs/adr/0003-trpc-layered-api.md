# ADR 0003: API を tRPC 化し domain / repository / router に分割する

- 日付: 2026-08-30
- ステータス: 採用
- 関連: Issue #285 / Epic #279 / ADR 0002

## 背景

#284 で HTTP レイヤを Hono へ置き換えたが、ルータの中身は Express 時代のままである。`packages/api/src/doctor/patients.ts` は 1 ファイルに zod スキーマ定義・認可・Prisma 呼び出し・レスポンス整形が同居しており、ロジックが純粋関数として切り出されていない。

その帰結としてテストが `supertest` + `prisma-mock` の一本槍になり、次のような検証が生まれている。

```ts
test("医者データの取得の失敗 : データがない時", async () => {
  const response = await request(app).get("/doctor/doctors")...
  expect(response.status).toBe(400);
})
```

これは「mock を設定しなかったので `undefined` が返り `catch` に落ちた」ことを確認しているだけで、仕様を検証していない。

同時に、フロントとバックエンドの間の型は手書きである。`fetch` の戻り値に `DoctorType` を宣言しているだけで、サーバの実際の戻り値とは何も繋がっていない。サーバ側の `select` を変えてもフロントの型は変わらない。

本 ADR はこの 2 つ、**テストしにくい構造**と**手書きの型**を同時に解消する。

なお Hono と tRPC は競合しない。Hono が Express の代わり（HTTP レイヤ）、tRPC が `fetch` + 手書きの型の代わり（RPC レイヤ）であり、重ねて使う。

## 決定

### 1. Hono の上に tRPC を 1 本マウントする

`@hono/trpc-server`（0.4.2、2026-01-12 公開）で `app.use("/trpc/*", ...)` にマウントする。CORS・CSRF・将来のヘルスチェックは Hono の素の機能として残し、アプリケーションの RPC だけを tRPC が担う。

tRPC の context は Hono の Context を保持する。これにより `login` / `logout` が `setCookie` / `deleteCookie` を呼べる。

```ts
type TrpcContext = {
    honoContext: Context;
    doctorId: number | null; // Cookie の JWT から解決。未ログインなら null
};
```

`protectedProcedure` は `doctorId` が `null` なら `UNAUTHORIZED` を投げ、通過後は `number` に絞り込む。#284 の `requireDoctor` と同じく、認可の通過が型で保証される設計を踏襲する。

### 2. `domain/` はロジックが実在する 3 箇所にだけ作る

13 エンドポイントの中身を調べたところ、I/O を伴わない純粋なロジックは次の 3 つしかない。

| 箇所 | ロジック |
|---|---|
| `patients` POST | 生年月日から初期パスワードを導出する |
| `medical_records` PUT | 既存カテゴリと指定カテゴリから削除分・追加分を求める |
| `medical_records` GET | `medical_categories[].categories` を `categories` へ平坦化する |

残る 10 箇所は Prisma の呼び出しと zod 検証しかない。ここに `domain/` を置いても、引数をそのまま `repository/` へ渡すだけのファイルが 10 個できる。Issue の完了条件は「`domain/` に Prisma / Hono / Next.js への import が 1 つも無い」であり、「全機能に domain がある」ではない。純粋な CRUD は `router/` から `repository/` を直接呼ぶ。

とりわけカテゴリの差分計算は、現在 `$transaction` の中に埋まっていて単体では検証できない。ここを切り出すことが本 Issue で最も価値のある変更である。

### 3. JWT の検証を `auth/token.ts` へ切り出し、REST と tRPC で共有する

移行中は REST の `requireDoctor`（Hono ミドルウェア）と tRPC の `protectedProcedure` が並存する。両者が別々に JWT を検証すると、片方だけ修正される事故が起きる。検証と発行を `auth/token.ts` に集約し、双方がそれを呼ぶ。

### 4. 機能単位で段階的に移行する

Hono に REST と tRPC を同時にマウントし、次の順で移す。各段階の終わりでアプリは完全に動作する。

| # | 対象 | domain |
|---|---|---|
| 1 | 基盤 + `categories` | なし |
| 2 | `doctors` / `login_doctor` | なし |
| 3 | `patients` | パスワード導出 |
| 4 | `medical_records` | 差分計算・平坦化 |
| 5 | `login` / `logout` | なし |

第 1 段階の「基盤」は次を指す。以降の段階はこの上に procedure を足すだけになる。

- `trpc/context.ts` / `trpc/init.ts` / `trpc/appRouter.ts`
- `auth/token.ts` の切り出しと、既存 `requireDoctor` のそこへの寄せ替え
- `@hono/trpc-server` による `app.ts` へのマウント
- `packages/api/package.json` への `types` / `exports` の追加
- `apps/web/src/lib/trpc.ts` の vanilla クライアント

`categories` を最初の移行対象に選ぶ理由は、認可付きの読み取りが 1 本だけで、入力も無く、`domain/` も不要な最小の機能だからである。配線そのものの誤りと、機能固有の誤りを切り分けられる。

各段階で「tRPC 側を作る → フロントの該当箇所を差し替える → 旧 REST ルートと旧 spec を削除する」まで行う。並存期間中は両経路のコードが一時的に重複するが、どのコミット時点でもアプリが動く状態を保てる利点の方が大きい。

Cookie を扱う `login` / `logout` を最後に置く理由は、Cookie の発行経路が最も壊れやすく、かつ他の全機能がその Cookie に依存しているためである。先に移すと、以降の全段階が新しい Cookie 発行経路の上で行われることになる。

### 5. フロントは vanilla クライアントまでに留める

`@trpc/client` の `createTRPCClient` を使い、既存の SWR / `useEffect` の中の `fetch` 呼び出しだけを差し替える。データ取得ライブラリの入れ替えは行わない。

tRPC の React クライアントは中身が TanStack Query であるため、React 版を導入すると #292（SWR → TanStack Query）の作業を先に食べてしまう。vanilla クライアントなら本 Issue の目的である型安全の確立を達成しつつ、#292 を「データ取得ライブラリの入れ替え」という単一の関心事の変更として残せる。

### 6. transformer に superjson を使う

`packages/schema` の `PatientType.birth` と `MedicalRecordsType.examination_at` は `Date` 型だが、JSON は文字列しか運べない。フロントが `new Date(patientData.birth)` と包み直しているのが、型が実態と食い違っている証拠である。

transformer を入れない場合、tRPC はサーバの戻り値の型をそのまま推論するため、型は `Date` を主張し実行時は文字列という食い違いが残る。**型安全の確立が目的の Issue で、型が嘘をつく状態を新たに作ることになる。** superjson（2.2.6）を入れて `Date` を透過させる。

フロント側の `new Date(...)` による包み直しは残す。`new Date(dateObject)` は複製を返すだけで害がなく、削除はフロントの整理を行う #292 に含める方が差分が追いやすい。

### 7. `GET /doctor/token_check` は移植せず削除する

リポジトリ全体を検索した結果、このエンドポイントは `app.ts` での登録以外にどこからも参照されていない。

git 履歴によれば、Issue #214（API のファイル分割）で作られ、当初は「トークンの有効期限が切れたらログイン画面へリダイレクトする」ためにフロントが叩いていた（`0198d86`）。`79ba5ce`（2025-03-05「ログインの内部仕様変更」）で Cookie の管理をフロント側から httpOnly のサーバ発行へ移した際に呼び出しが削除され、エンドポイントだけが残った。

**その役割は 1 つのものに置き換わったわけではなく、2 つに分かれた。**

| `token_check` がしていたこと | 現在の担当 |
|---|---|
| `/doctor` 配下へ入れるかの判定 | `apps/web/src/proxy.ts` の Cookie 存在チェック |
| トークンが実際に有効かの検証 | 各リクエストの `requireDoctor`（JWT の署名と期限を検証） |

**「トークンが無効ならログイン画面へ飛ばす」機能は、厳密には代替されていない。** `proxy.ts` は Cookie の存在しか見ておらず署名も期限も検証しない。また API が 401 / 403 を返しても、`GlobalDoctorContext` の fetcher は `throw new Error(res.status)` するだけでリダイレクトしない。

実害が出ていないのは、Cookie の `Max-Age`（1 時間）が JWT の `expiresIn`（1 日）より短いためである。ブラウザが先に Cookie を捨て、その時点で `proxy.ts` がログイン画面へ飛ばすので、期限切れの JWT を持ったまま通過する状態が発生しない。踏み得るのは「Cookie は生きているが JWT が無効」というケースに限られ、実質的にはサーバ側で `JWT_SECRET_KEY` を変更した場合などである。

削除の判断はこの分析によって変わらない。呼び出し元が存在しない以上、tRPC へ移植する対象ではない。ただし**上記の欠落は本 ADR の範囲外の課題として残る**。Cookie と JWT の有効期限の整合は #286 のスコープであり、失効時のリダイレクトの扱いはそこで検討する。

移行対象は 14 ではなく 13 エンドポイントになる。

### 8. エラーは `TRPCError` へ対応付け、日本語メッセージは変えない

| 現在の HTTP ステータス | tRPC のコード |
|---|---|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |

メッセージの文字列は 1 文字も変えない。フロントは `errorData.error` を読んでいる 5 箇所を `TRPCClientError` の `.message` に差し替えるだけで、画面に出る文言は変わらない。

### 9. テストは `domain/` の単体テストに限る

`domain/` の 3 ファイルに mock を使わない単体テストを書く。`repository/` と `router/` の統合テストは、実 DB を扱える PGlite が入る #288 に委ねる。

REST ルートの削除と同時に `doctors.spec.ts` / `login.spec.ts` / `login_doctor.spec.ts` を削除し、`vitest-mock-extended` と `test/prismaMock.ts` を依存から外す。これらは Issue が批判している「実装の写経」そのものであり、代替を書かずに消すのが正しい。`csrf.spec.ts` と `requireDoctor.spec.ts` は HTTP レイヤの検証なので残す。

## 検討して採用しなかった案

### #285 で TanStack Query まで導入する

#292 の 1 番目と 2 番目の項目を先に消化することになり、差分に「API の作り直し」と「データ取得ライブラリの入れ替え」が混ざる。どちらが原因で壊れたかを切り分けられなくなる。

### フロントに一切触れず #292 へ全部委ねる

Issue #285 の完了条件「フロントから `trpc.*` 経由で全機能が動作する」を満たせない。作った tRPC API が画面から動くことを確認しないまま次のフェーズへ進むことになる。

### 一括で切り替える

tRPC 側を全部作ってからフロントを一斉に切り替える案。中間状態の重複が無く差分はきれいだが、移行の途中で何も画面から検証できない期間が長く続く。13 エンドポイントは段階的に移せる規模である。

### 全機能に 3 層を適用する

構造は完全に均一になるが、10 個の「引数をそのまま渡すだけ」のファイルが生まれる。将来ロジックが増えたときに層を足すのは容易であり、先回りして空の層を作る理由がない。

### PGlite を本 Issue へ前倒しする

`repository/` と `router/` の統合テストまで書けるが、#285 の作業量が大幅に増える。`domain/` の単体テストだけでも「純粋関数は mock なしでテストできる」という主張は証明できる。

## 波及

- `packages/api/package.json` に `types` と `exports` を追加する。`apps/web` が `AppRouter` の型を参照するため
- **`apps/web` からの `@repo/api` の参照は必ず `import type` にする。** `@repo/api` は Prisma を import しており、値として読み込むとブラウザ向けのビルドが壊れる。`import type` は型検査後に消えるため安全だが、`import` と書き間違えた瞬間に壊れる。**この誤りは `bun run build:web` が検出する**（Prisma をブラウザ向けにバンドルしようとして失敗する）ため、検証手段は存在する。ESLint の `consistent-type-imports` による機械的な強制は、`apps/web` 全体の import 形式に影響するため本 ADR の範囲外とする
- superjson により `Date` が実際の `Date` としてフロントへ届くようになる。`dayjs()` と `new Date()` はどちらも `Date` を受け付けるため、既存のフロントのコードは変更なしで動く
- `vitest-mock-extended` と `test/prismaMock.ts` が不要になる
- `packages/api/src/doctor/` は移行完了時点で空になり、ディレクトリごと消える
- `GET /doctor/token_check` が存在しなくなる。参照は無いため影響なし
- 移行中は同じ機能の REST 実装と tRPC 実装が一時的に併存する。段階の終わりで必ず旧実装を削除し、併存を次の段階へ持ち越さない
