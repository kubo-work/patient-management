# ADR 0007: データ取得を SWR から TanStack Query（tRPC 統合）へ置き換える

- 日付: 2026-10-04
- ステータス: 採用
- 関連: Issue #292 / Epic #279 / ADR 0003

> **本 ADR は実装の後に書いた。** ADR 0001〜0006 は着手前に書いたが、#292 は Issue 本文の「やること」を計画として実装を先に進め、Issue に書かれていない判断が複数あったことに後から気付いた。以下はその判断の事後の記録である。

## 背景

ADR 0003 決定 5 は、tRPC 化（#285）の時点ではフロントを vanilla クライアント（`createTRPCClient`）までに留め、データ取得ライブラリの入れ替えを #292 へ残した。#292 はその残りを消化する。

### 着手時の状態

| 取得の方法 | 箇所 |
|---|---|
| SWR（`useSWR`） | `providers/GlobalDoctorContext.tsx`（ログイン中の医師・カテゴリ・医師一覧）、`hooks/usePagedQuery.ts`（3 つの一覧） |
| `useEffect` で取得し `useState` に入れる | `hooks/usePatientEdit.ts`、`hooks/useDoctorEdit.ts`、`doctor/medical-records/page.tsx` |
| `trpcClient.*.mutate()` を `try/catch` で囲む | 登録・更新・削除・ログイン・ログアウトの 5 つの hook |

### Issue 本文と実態のズレ

#292 の本文は `frontend/src/app/hooks/useMedicalRecords.tsx` を例に、SWR のキャッシュを `useState` へ複製するコードを問題として挙げている。

```ts
const [medicalRecord, setMedicalRecord] = useState<MedicalRecordsType[] | null>([]);
useEffect(() => { data && setMedicalRecord(data); }, [data, setMedicalRecord]);
```

着手時には、この複製は既に無かった（#339 でサーバ側ページングへ移したときに消えている）。同じ形の複製が残っていたのは、上の表の 2 行目の 3 箇所である。

また、本文は hook の再配置先を `apps/web/src/features/*/hooks/` と書いているが、`features` ディレクトリは `apps/web/src/app/features/doctor/` にある（決定 8）。

## 決定

### 1. `@trpc/tanstack-react-query` を使い、プロバイダはルートレイアウトに置く

| パッケージ | バージョン | 公開日 |
|---|---|---|
| `@trpc/tanstack-react-query` | 11.18.0 | 2026-06-17 |
| `@tanstack/react-query` | 5.104.0 | 2026-09-26 |

`@trpc/tanstack-react-query` は、導入済みの `@trpc/client` / `@trpc/server`（11.18.0）と同じ版にした。`@tanstack/react-query` の最新は 5.104.1（2026-10-02 公開）だったが、公開から 3 日以内の版は入れない方針のため 1 つ前にした。

`lib/trpc.ts` で `createTRPCContext<AppRouter>()` から `TRPCProvider` と `useTRPC` を作り、`providers/TRPCQueryProvider.tsx` をルートレイアウトの `MantineProvider` の中に置く。ログイン画面も `useMutation` を使うため、医師用のレイアウトではなくルートに置いている。

`QueryClient` は Next.js 同梱のガイド（`next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`）の形に合わせ、サーバでは描画ごとに作り、ブラウザではモジュール変数の 1 つを使い回す。

画面のコードは `trpcClient` を直接呼ばない。`useTRPC()` が返す `trpc.*.queryOptions()` / `mutationOptions()` を `useQuery` / `useMutation` に渡す。`lib/trpc.ts` から `trpcClient` の export を外し、プロバイダだけが呼ぶ `createAppTRPCClient` に替えたのは、直接呼び出しを書けなくするためである。

### 2. HTTP 4xx は再試行しない。それ以外の既定値は変えない

TanStack Query は既定で、失敗した取得を 3 回まで間隔を空けて再試行する。入力の誤りや未認証（HTTP 4xx）は取り直しても結果が変わらず、その間は読み込み中の表示が続く。存在しない患者の診察履歴を開くと、「データが見つかりません」が出るまで数秒待たされることになる。

`TRPCClientError` の `data.httpStatus` が 500 未満なら再試行しない。通信の失敗（`httpStatus` が無い）とサーバ側の障害（5xx）は、既定どおり 3 回まで再試行する。

全体の既定値である `staleTime`（既定 0）と `refetchOnWindowFocus`（既定 true）は変えていない。画面を開き直したときとタブへ戻ったときに取り直す挙動は、SWR のときと同じである。編集画面の元データの取得だけは例外で、タブへ戻ったときに取り直さない（決定 4）。

### 3. `GlobalDoctorContext` を廃止し、使う場所で `useQuery` する

`GlobalDoctorContext` は、ログイン中の医師・カテゴリ・医師一覧の 3 つを SWR で取得し、値と `mutate` を Context で配っていた。

TanStack Query では、同じ `queryOptions` を渡した `useQuery` は 1 つのキャッシュを共有する。Context で値を配る役目はキャッシュが担い、`mutate` を配る役目は `invalidateQueries` で不要になる。Context を残すと、キャッシュの上にもう 1 段の共有の仕組みを重ねることになる。

| データ | 取得する場所 |
|---|---|
| ログイン中の医師 | `DoctorDashboardLayout`（ヘッダーの医師名）、`DoctorForm`（パスワード欄を出すかの判定）、`MedicalRecordForm`（担当者の初期値） |
| カテゴリ、医師一覧 | `useMedicalRecordForm` |

### 4. 取得が済んでからフォームを描画し、初期値は `initialValues` で渡す

移植前の編集フォームは、空のフォームを先に描画し、取得したデータを effect の中の `form.setValues` で流し込んでいた。

```ts
useEffect(() => {
    if (patientData) {
        form.setValues({ name: patientData.name, /* ... */ });
    }
}, [patientData])
```

これをそのまま `useQuery` に載せ替えると、タブへ戻ったときの再取得で `patientData` の参照が変わり、**入力中の値が取得し直した値で上書きされる。** SWR は取得結果を深く比較して参照を保っていたが、TanStack Query の構造共有は `Date` を含むオブジェクトの参照を保たない（superjson により `birth` や `created_at` は `Date` で届く）。

取得する外側のコンポーネントと、フォーム本体を分ける。

| 外側（取得と読み込み表示） | フォーム本体 | hook |
|---|---|---|
| `EditPatientContents` | `PatientForm` | `usePatientEdit(patient)` |
| `EditDoctorContents` | `DoctorForm` | `useDoctorEdit(doctor)` |
| `MedicalRecordForm` | `MedicalRecordFormFields` | `useMedicalRecordForm({ medicalRecord, defaultDoctorId, ... })` |

hook の引数は `id` から「取得済みの値（新規なら `null`）」に変わり、`useForm` の `initialValues` に直接入れる。`initialValues` は最初の描画でしか使われないため、その後に再取得が起きてもフォームの値は変わらない。

編集フォームの元データ（`patients.byId` / `doctors.byId`）は、**この画面を開いてから取り直した値だけ**を初期値にする。読み込み中の判定に `isPending` ではなく `isFetchedAfterMount` を使う。

```ts
const { data: patient, error, isFetchedAfterMount } = useQuery(
    trpc.doctor.patients.byId.queryOptions(
        { patientId },
        { staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }
    )
);

if (error) return <FetchErrorAlert error={error} />;
if (!isFetchedAfterMount || patient === undefined) return <LoadingIndicator />;
```

キャッシュに値があると `isPending` は最初から `false` になり、取り直す前の古い値でフォームが描画される。`initialValues` は最初の描画でしか使われないため、その後に届く新しい値は反映されない。保存すると、その間に他の医師が行った更新を古い値で上書きする。

当初は `gcTime: 0` でキャッシュを残さない形にしたが、これは効かなかった。診察履歴ページも同じ `patients.byId` を既定の `gcTime`（5 分）で取得しており、TanStack Query は `gcTime` を `Math.max(既存, 新規)` で更新する（`query-core/src/removable.ts`）。後から 0 を渡しても 5 分のままになる。

`isFetchedAfterMount` は「表示のたびに取り直す」ことを前提にしているため、既定値と同じ `staleTime: 0` を明示している。全体の `staleTime` を伸ばしても、この取得だけは取り直す。

**取得は、画面を開いたときの 1 回だけにする。** `refetchOnWindowFocus` と `refetchOnReconnect` を `false` にし、保存後の `invalidateQueries` も `refetchType: "none"` にして、表示中の編集画面の取得を取り直させない。初期値は開いたときの値しか使わないため、表示後の取り直しは要らない。

これは不具合の修正として入れた。TanStack Query は取り直しに失敗すると、`data` を残したまま `error` を入れる。上のコードは `error` を先に判定するため、タブへ戻ったときの取り直しが通信の失敗や認証切れで失敗すると、フォームがエラー表示に替わり、入力中の内容が消えていた。判定の順番を入れ替えるだけでは直らない。`isFetchedAfterMount` は取得の失敗でも `true` になり、キャッシュの古い値が初期値に入るためである。

診察フォームは、新規作成のときの担当者の初期値にログイン中の医師を使う。そのため外側の `MedicalRecordForm` はログイン中の医師の取得を待つ。開く診察ごとに `key` を付け、別の診察を開いたときにフォームを作り直す。

### 5. 「今のページが無くなったら最後のページへ移る」処理は描画時に行う

最後のページに 1 件だけ残った行を削除すると、そのページ自体が無くなる。移植前の `usePagedQuery` は、SWR に渡す取得関数の中で応答の全件数とリクエストしたページ番号を比べ、`setPagination` を呼んでいた。

`useQuery` へは tRPC の `queryOptions` をそのまま渡すため、取得関数に処理を挟めない。取得済みの全件数と今のページを描画のたびに比べ、今のページが範囲の外なら `setPagination` を呼ぶ。

```ts
if (data !== undefined && !isPlaceholderData) {
    const lastPageIndex = toLastPageIndex(data.totalCount, pageRequest.pageSize);
    if (pagination.pageIndex > lastPageIndex) {
        setPagination({ ...pagination, pageIndex: lastPageIndex });
    }
}
```

描画中に条件付きで自分の state を更新するのは、React が認めている書き方である（effect で行うと、範囲外のページを 1 度描画してから直すことになる）。`keepPreviousData` で前のページを仮に表示している間（`isPlaceholderData`）の全件数は、今の条件の応答ではないため比べない。

### 6. 更新は `useMutation` にし、取り直しの範囲は機能の単位で指定する

`try/catch` と `useState` のエラー文言を `useMutation` に置き換える。エラー文言は `mutation.error?.message` から計算し、state に持たない。

成功時の取り直しは、SWR の `mutate` を引数で受け渡す形をやめ、保存する hook 自身が `invalidateQueries` を呼ぶ。範囲は procedure ごとではなく、router の単位（`pathFilter()`）で指定する。

| 更新 | 取り直しの範囲 |
|---|---|
| 患者の登録・更新 | `trpc.doctor.patients`（一覧と 1 件取得） |
| 医師の登録・更新 | `trpc.doctor.doctors`（一覧・全件・1 件取得）と `trpc.doctor.loginDoctor` |
| 診察の登録・更新・削除 | `trpc.doctor.medicalRecords`（全ページ） |

医師の更新で `loginDoctor` も取り直すのは、自分の名前を変えたときにヘッダーの医師名へ反映するためである。移植前は、タブを切り替えるまで古い名前のままだった。

診察は、一覧の取り直しを待ってからモーダルを閉じる。閉じた時点で一覧が新しくなっている。患者と医師は一覧画面へ遷移するため待たない（遷移先で取り直す）。

### 7. ログアウト時にキャッシュを消す

`useDoctorLogout` は、成否によらず `queryClient.clear()` を呼んでからログイン画面へ戻る。キャッシュを残すと、次にログインした医師に、前の医師が取得した患者や診察が一瞬表示される。SWR のときもキャッシュは残っていたが、今回あわせて塞いだ。

### 8. hook は `app/features/doctor/<機能>/hooks/` に置く

`app/hooks/` の 11 個の hook を、使う機能の下へ移した。複数の機能が使うもの（`usePagedQuery` / `useShowNotification` / `useGlobalDoctorLogin`）は `app/features/doctor/hooks/` に置く。

Issue 本文の `apps/web/src/features/*/hooks/` は、`features` を `app` の外へ出した構成を前提にしている。`features` ディレクトリの移動は、全コンポーネントの import に影響する別の関心事なので行わない。

### 9. フロントの `new Date(...)` による包み直しを外す

ADR 0003 決定 6 が #292 へ残した作業である。superjson により `birth` と `examination_at` は `Date` で届くため、`new Date(patientData.birth)` は複製を作っているだけだった。

### 10. 取得の失敗は、該当なしとそれ以外を分けて表示する

`patients.byId` / `doctors.byId` は、該当なしのとき `null` を返さず `NOT_FOUND` を throw する。移植前の画面は取得結果が空かどうかで「データが見つかりません」を出していたが、tRPC 化の後はこの分岐に到達していなかった。

`components/FetchErrorAlert.tsx` が、エラーの `data.code` が `NOT_FOUND` なら「データが見つかりません」、それ以外（通信の失敗・サーバ側の障害・認証切れ）なら「データの取得に失敗しました。」を出す。

一覧も同じコンポーネントを使う。移植前から、一覧の取得に失敗すると空の表と「全 0 件」が出るだけだった。`usePagedQuery` は `error` を返していたが、読んでいるコンポーネントが無かった。表の状態（`PagedTableState`）に `fetchError` を加え、`DataTable` が表の上に出す。

診察履歴ページ（`doctor/medical-records/page.tsx`）は、取得済みの患者があれば表示を続け、無いときだけエラーか読み込み中を出す。こちらは表示用でキャッシュの値を出して問題がなく、表示後の取り直しが失敗しても、モーダルで入力中の診察フォームごと画面を外さない。

エラーの型（`FetchError`）と該当なしの判定（`isNotFoundError`）は `app/util/fetchError.ts` に置き、コンポーネントと hook の両方がそこから取る。

読み込み中の表示は `components/LoadingIndicator.tsx`（Mantine の `Loader`）にそろえた。表示済みの内容に重ねる箇所（表、ログインフォーム）は、従来どおり `LoadingOverlay` を使う。

### 11. 送信中はボタンを押せなくする

保存する hook が `isSaving`（診察は `isDeleting` も）を返し、ボタンを Mantine の `loading` にする。

診察フォームは、一覧の取り直しを待ってからモーダルを閉じる（決定 6）ため、押せる時間が長い。連打すると診察が 2 件作られる。保存中は削除を、削除中は保存を押せなくし、同じ診察へ 2 つの操作を同時に送らない。

患者と医師は、成功後も一覧へ遷移し終えるまで `isSaving` を `true` のままにする（`isPending || isSuccess`）。

## 検討して採用しなかった案

### `GlobalDoctorContext` を残し、中身だけ `useQuery` にする

差分は最も小さい。しかし Context が配る `loginDoMutate` / `categoriesDoMutate` / `doctorsDoMutate` は `invalidateQueries` で不要になり、値を配る役目もキャッシュと重複する。Issue の目的（データ取得を TanStack Query に統一する）に対して、統一されない層が 1 つ残る。

### effect を残し、`form.initialize` で 1 度だけ流し込む

Mantine の `form.initialize` は最初の 1 回だけ値を入れるため、再取得による上書きは防げる。コンポーネントを分ける必要もない。採用しなかったのは、「取得前の空のフォームを描画し、後から値が入る」構造が残るためである。取得前に入力を始めると、その入力は取得後に消える。

### `staleTime` を伸ばして再取得を減らす

`staleTime` を数十秒にすれば、画面を行き来するたびの取得が減る。この院内向けのアプリでは、他の医師が登録した患者や診察がすぐ見えることの方が重要で、取得の回数は問題になっていない。SWR のときと同じ挙動を保つ方を選んだ。

### Server Component で取得し、クライアントへ渡す

Next.js のガイドは、Server Component で取得した値を初期データとして渡す形も示している。認証が httpOnly Cookie で、API が別のサブドメイン（ADR 0006）にあるため、サーバ側の取得は Cookie の転送と CSRF の扱いを新たに設計する必要がある。#292 の範囲（データ取得ライブラリの入れ替え）を超える。

### `useSuspenseQuery` で読み込み表示を Suspense に任せる

読み込み表示を各コンポーネントから消せる。エラー時の表示を Error Boundary で作り直す必要があり、現在の「データが見つかりません」の分岐をそのまま移せないため見送った。

## 波及

- `swr` が依存から消える。`apps/web/src/app/hooks/` と `providers/GlobalDoctorContext.tsx` が無くなる
- **患者・医師の編集画面は、取得が済むまで読み込み表示（Mantine の `Loader` を使った `LoadingIndicator`）を出す。** 移植前は空のフォームが先に表示され、後から値が入っていた
- **診察フォームのモーダルは、ログイン中の医師の取得が済むまで同じ読み込み表示を出す。** 通常はレイアウトが先に取得しているため、表示されることはほぼ無い
- 診察履歴ページに元からあった素の `<div>Loading...</div>` も `LoadingIndicator` に替えた。表示済みの内容に重ねる箇所（表、ログインフォーム）は、従来どおり `LoadingOverlay` を使う
- **カテゴリと医師一覧（全件）は、診察フォームを開いたときに初めて取得される。** 移植前は医師用のどの画面でも、レイアウトの表示時に取得していた。患者一覧や医師一覧だけを見る場合の取得が 2 つ減る
- それに伴い、`httpBatchLink` が 1 本にまとめるリクエストの組み合わせが変わる。移植前はレイアウトの 3 つと画面の 1 つが 1 本になっていた（#307 の本文の例）。バッチの設定自体は変えていない
- 医師を更新すると、ヘッダーの医師名がすぐ変わる
- ログイン画面の「ログインの有効期限が切れた可能性があります。」は、ログインを試す前だけ表示する。移植前と同じだが、state ではなく `useMutation` の状態から計算する
- lint のエラーが 3 件から 1 件になる。effect の中で `setState` していた `doctor/medical-records/page.tsx` と `useDoctorLogin.ts` が無くなったため。残る 1 件は `GlobalDoctorLoginContext.tsx`（スコープ外）
- `MedicalRecordForm.tsx` とそのスタイルを `components/` から `medical-records/` へ移した。診察履歴でしか使わず、`medical-records/hooks/` の hook を import しているため
- E2E を 7 件追加した。このうち 4 件は、不具合のあるコードで実行して失敗することを確かめてある（決定 4 の 1 件、入力が消えないことの 2 件、決定 11 の 1 件）。残りの 3 件は、修正前のコードでは実行していない
  - 最後のページに 1 件だけ残った診察を削除すると、前のページが表示されること（決定 5）。診察を DB へ直接登録する `insertMedicalRecord` を `e2e/support/testDatabase.ts` に追加した
  - 診察履歴を開いた後に他で患者の名前が変わっても、編集フォームには取得し直した名前が入ること（決定 4）。患者の名前を DB で書き換える `renamePatient` を追加した
  - 一覧の取得に失敗するとエラーが表示されること、存在しない患者の編集画面で「データが見つかりません」が表示されること（決定 10）。後者は再試行が入ると既定の待ち時間（5 秒）に収まらないため、HTTP 4xx で再試行しないこと（決定 2）の確認も兼ねる
  - 診察の保存中は保存ボタンを押せず、診察が 1 件だけ作られること（決定 11）。同じファイルに、指定したリクエストを遅らせる `delayTrpcRequest` を追加した
  - 患者の編集フォームと診察フォームで、入力した後に取り直しが失敗しても入力が消えないこと（決定 4・10）。`e2e/support/trpcFailure.ts` に、指定した取得だけを失敗させる `failTrpcQuery` と、タブへ戻ったときの取り直しを起こす `returnToTab` を追加した

## 検証していないこと

実装はしたが、テストでも実機でも確かめていない。

- 患者と医師のフォーム、診察の削除で、送信中にボタンが押せなくなること（決定 11）。診察の保存だけは E2E で確かめた
- 通信の失敗とサーバ側の障害（5xx）で、3 回まで再試行すること（決定 2）
- ログアウト後にキャッシュが消えていること（決定 7）

hook の単体テストは、フロントに React Testing Library を入れる #333 で扱う。

## スコープ外

- **`GlobalDoctorLoginContext` の整理**: `isLogin` を読んでいる箇所がアプリ内に無く、`setIsLogin` が呼ばれるだけになっている。SWR とは無関係のため触っていない。lint に残る 1 件のエラーはここにある
- **tRPC のバッチ設定**: `maxURLLength` と `httpBatchStreamLink` の採否は #307 で扱う
- **`features` ディレクトリを `app` の外へ出すこと**（決定 8）
- **作成・更新の hook とフォームの共通化**: `notifyError`、保存結果の値（`"new"` / `"update"`）と URL のキー（`"success"`）、メールアドレスと未来日時の検証、フォームの行の JSX が、患者・医師・診察で重複している。差分が広がるため、#333 の前に別の Issue で扱う
- **認証切れのときにログイン画面へ送ること**: 今は各画面が「データの取得に失敗しました。」を出すだけである。ログイン画面には `?status=error` で期限切れを案内する分岐があるが、この値を付けて遷移させる箇所はリポジトリ内に無く、移植前から到達していない
- **フォームの検証を zod スキーマへ寄せること**: API の入力定義は意図的に緩くしてあり（`router/patients.ts` のコメント）、フォームと共有するにはその設計を変える必要がある
