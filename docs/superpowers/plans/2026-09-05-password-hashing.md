# パスワードのハッシュ化 実装計画（Issue 286 第 2 フェーズ）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** パスワードを argon2id でハッシュ化して保存し、7 つの経路でクライアントへ渡っているパスワードを止める。

**Architecture:** ハッシュ化と検証を `@repo/auth` のサブパス `@repo/auth/password` へ置き、`apps/web` が argon2 を引き込まないようにする。ログイン照合は I/O を持たない `domain/doctorLogin.ts` へ切り出し、医師が見つからない場合もダミーハッシュに対して検証を走らせて応答時間を揃える。既存データは冪等な移行スクリプトで一括ハッシュ化する。

**Tech Stack:** bun workspaces / TypeScript 7 / @node-rs/argon2 2.2.0 / Hono 4 / tRPC 11 / Next.js 16 / Prisma 7 / Vitest 4

**Spec:** `docs/adr/0005-password-hashing.md`

## Global Constraints

- `@node-rs/argon2` は **2.2.0** で固定する（2026-08-29 公開）。リリースから 3 日以内のバージョンは使わない
- argon2 のパラメータは **`memoryCost: 19456` / `timeCost: 2` / `parallelism: 1`** を明示的に指定する。これは OWASP 推奨値であり、2.2.0 の既定値とも一致するが、版が上がったときに黙って変わらないよう明示する
- **平文を受け付ける分岐を作らない**（ADR 0005 決定 2）。`verifyPassword` は PHC 形式でない入力に対して fail-closed で `false` を返す
- **本番（Neon）へ移行スクリプトを適用しない。** 適用は #287 の切り替えと同時（ADR 0005 決定 2・7）
- 変数名・関数名・型名を省略しない
- コメントは日本語で書き、既存ファイルのコメント密度に合わせる
- **パスワードとハッシュを標準出力・コミット・会話ログのいずれにも出さない**
- 既存の日本語エラーメッセージは変えない

## ADR からの意図的な逸脱

計画を書く過程で、ADR の記述より良い置き場所が 2 点見つかった。ADR の意図は変えていない。

1. **`findDoctorByEmail` は `repository/doctors.ts` ではなく `repository/authDoctors.ts` に置く。** ADR 決定 6 の表は `repository/doctors.ts` と書いているが、`authDoctors.ts` はログイン照合専用のクエリを置くために既に存在するファイルであり（現在 `findDoctorByCredentials` がある）、そちらが自然な置き場所である。「`password` を select するのはここだけ」という決定 6 の趣旨は変わらない。
2. **照合ロジックを `domain/doctorLogin.ts` へ切り出す。** ADR 決定 5 は「医師が見つからない場合もダミーのハッシュに対して検証を走らせる」とだけ書いており、置き場所を定めていない。`router/auth.ts` に直接書くと DB 無しでは検証できないが、`domain/` へ出せば単体テストが書ける。ADR 0003 決定 2 の「`domain/` に Prisma / Hono / Next.js を import しない」は満たす（`@repo/auth/password` は I/O を持たない）。

---

### Task 1: `@repo/auth` に argon2 のハッシュ化を追加する

**Files:**
- Create: `packages/auth/src/password.ts`
- Test: `packages/auth/test/password.spec.ts`
- Modify: `packages/auth/package.json`

**Interfaces:**
- Consumes: なし
- Produces:
  - `@repo/auth/password` の `hashPassword(plainPassword: string): Promise<string>`
  - `@repo/auth/password` の `verifyPassword(storedPasswordHash: string, plainPassword: string): Promise<boolean>`

- [ ] **Step 1: 依存とサブパス export を追加する**

`packages/auth/package.json` の `dependencies` に `"@node-rs/argon2": "2.2.0"` を追加する（`jose` と並べる）。

`exports` に `./password` を追加する。**`index.ts` からは再 export しない。** `apps/web` は `@repo/auth`（トークン検証のみ）を import するため、バレルに載せると `@node-rs/argon2` が proxy のバンドルへ入る（ADR 0005 波及）。

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./password": {
      "types": "./dist/password.d.ts",
      "default": "./dist/password.js"
    },
    "./package.json": "./package.json"
  },
```

Run: `bun install`
Expected: `@node-rs/argon2@2.2.0` と、プラットフォーム別バイナリ（ローカルは `@node-rs/argon2-darwin-arm64`）が追加される

- [ ] **Step 2: 失敗するテストを書く**

`packages/auth/test/password.spec.ts`:

```ts
import { describe, test, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/password.js";

const plainPassword = "correct-horse-battery-staple";

describe("hashPassword", () => {
    test("PHC 形式の argon2id ハッシュを返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        expect(storedPasswordHash.startsWith("$argon2id$")).toBe(true);
    });

    test("OWASP 推奨のパラメータがハッシュに埋め込まれている", async () => {
        // PHC 形式はパラメータを自己記述する。ここが変わると既存ハッシュとの
        // 互換や強度が変わるため、値そのものを検証する。
        const storedPasswordHash = await hashPassword(plainPassword);
        expect(storedPasswordHash).toContain("m=19456,t=2,p=1");
    });

    test("同じパスワードでも毎回異なるハッシュになる", async () => {
        // ソルトが毎回生成されることの確認。同一になるならソルトが無い。
        const first = await hashPassword(plainPassword);
        const second = await hashPassword(plainPassword);
        expect(first).not.toBe(second);
    });
});

describe("verifyPassword", () => {
    test("正しいパスワードなら true を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyPassword(storedPasswordHash, plainPassword)).resolves.toBe(true);
    });

    test("誤ったパスワードなら false を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyPassword(storedPasswordHash, "wrong-password")).resolves.toBe(false);
    });

    // ADR 0005 決定 2。lazy migration をしないため、移行漏れの平文が残っていても
    // ログインさせない。argon2 の verify は PHC 形式でない入力に例外を投げるので、
    // それを握って false にする。ここが throw すると 500 になり fail-open と
    // 区別がつかなくなる。
    test("平文が保存されている行は例外ではなく false を返す", async () => {
        await expect(verifyPassword("plaintext-password", "plaintext-password")).resolves.toBe(false);
    });

    test("空文字が保存されている行も false を返す", async () => {
        await expect(verifyPassword("", plainPassword)).resolves.toBe(false);
    });
});
```

- [ ] **Step 3: テストを実行して失敗することを確認する**

Run: `bun run --filter @repo/auth test`
Expected: FAIL。`../src/password.js` が解決できない

- [ ] **Step 4: `password.ts` を実装する**

`packages/auth/src/password.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

// OWASP のパスワード保存ガイドが推奨する argon2id のパラメータ。
// @node-rs/argon2 2.2.0 の既定値と一致するが、版が上がったときに
// 既定が黙って変わらないよう明示する（ADR 0005 決定 1）。
const argon2Options = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};

export const hashPassword = (plainPassword: string): Promise<string> =>
    hash(plainPassword, argon2Options);

// verify は PHC 形式でない文字列（移行漏れの平文など）を渡すと例外を投げる。
// ここで握って false を返し fail-closed にする。lazy migration をしない決定
// （ADR 0005 決定 2）の下では、平文が残っている行はログインできないのが正しい。
//
// 例外を素通しすると tRPC が 500 を返し、「パスワードが違う」と
// 「移行が漏れている」を呼び出し側が区別できなくなる。
export const verifyPassword = async (
    storedPasswordHash: string,
    plainPassword: string
): Promise<boolean> => {
    try {
        return await verify(storedPasswordHash, plainPassword, argon2Options);
    } catch {
        return false;
    }
};
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `bun run --filter @repo/auth test`
Expected: PASS。`token.spec.ts` の 7 件と合わせて 12 件

- [ ] **Step 6: `apps/web` が argon2 を引き込んでいないことを確認する**

Run: `bun run build`
Expected: 成功。`apps/web` は `@repo/auth`（バレル）しか import しておらず、そこから `password.ts` へは辿れないため、proxy のバンドルに argon2 は入らない

- [ ] **Step 7: コミットする**

```bash
git add packages/auth bun.lock
git commit -m "$(cat <<'EOF'
feat: argon2id によるパスワードのハッシュ化を @repo/auth へ追加する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 2: ログイン照合をハッシュ検証へ切り替える

**Files:**
- Create: `packages/api/src/domain/doctorLogin.ts`
- Test: `packages/api/test/domain/doctorLogin.spec.ts`
- Modify: `packages/api/src/repository/authDoctors.ts`
- Modify: `packages/api/src/router/auth.ts`
- Modify: `packages/api/package.json`

**Interfaces:**
- Consumes: `@repo/auth/password` の `hashPassword` / `verifyPassword`（Task 1）
- Produces:
  - `domain/doctorLogin.ts` の `verifyDoctorPassword(storedPasswordHash: string | null, plainPassword: string): Promise<boolean>`
  - `repository/authDoctors.ts` の `findDoctorByEmail(email: string): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: { id: true; password: true } }> | null>`

- [ ] **Step 1: `@repo/auth` を `packages/api` の依存に確認する**

`packages/api/package.json` の `dependencies` に `"@repo/auth": "workspace:*"` が既にあることを確認する（ADR 0004 で追加済み）。サブパス `@repo/auth/password` は同じ依存で解決するため、追加は不要。

Run: `grep '"@repo/auth"' packages/api/package.json`
Expected: 1 行ヒットする

- [ ] **Step 2: ダミーハッシュを生成する**

応答時間を揃えるためのダミーハッシュは、**実際に検証可能な PHC 文字列でなければならない。** 形式が不正だと `verifyPassword` が即座に `false` を返し、時間が揃わず対策が無意味になる。

Run:
```bash
node -e "import('@node-rs/argon2').then(async ({ hash }) => console.log(await hash('dummy-password-for-timing-equalization', { memoryCost: 19456, timeCost: 2, parallelism: 1 })))"
```
Expected: `$argon2id$v=19$m=19456,t=2,p=1$...` で始まる文字列が出力される。**この出力を次のステップのコードへ貼り付ける。** 実在のアカウントのパスワードではないため、コミットして差し支えない

- [ ] **Step 3: 失敗するテストを書く**

`packages/api/test/domain/doctorLogin.spec.ts`:

```ts
import { describe, test, expect } from "vitest";
import { hashPassword } from "@repo/auth/password";
import { verifyDoctorPassword } from "../../src/domain/doctorLogin.js";

const plainPassword = "doctor-password";

describe("verifyDoctorPassword", () => {
    test("保存されたハッシュと一致すれば true を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyDoctorPassword(storedPasswordHash, plainPassword)).resolves.toBe(true);
    });

    test("保存されたハッシュと一致しなければ false を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyDoctorPassword(storedPasswordHash, "wrong-password")).resolves.toBe(false);
    });

    // 医師が見つからない場合。呼び出し側は null を渡す。
    test("医師が見つからない場合は false を返す", async () => {
        await expect(verifyDoctorPassword(null, plainPassword)).resolves.toBe(false);
    });

    // ADR 0005 決定 5。存在しないメールアドレスが即座に失敗すると、応答時間で
    // アカウントの存在が判別できてしまう。医師が見つからない場合もダミーハッシュに
    // 対して検証を走らせることで時間を揃える。
    //
    // 時間そのものを閾値で検証するとマシンの負荷でぶれるため、「一致する場合と
    // 同じオーダーの時間がかかる」ことだけを緩く確認する。ダミーハッシュを
    // 不正な文字列に書き換える退行は、この検証で捕まる（即座に返るようになるため）。
    test("医師が見つからない場合も検証と同程度の時間がかかる", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);

        const startOfFoundCase = performance.now();
        await verifyDoctorPassword(storedPasswordHash, "wrong-password");
        const foundCaseDuration = performance.now() - startOfFoundCase;

        const startOfMissingCase = performance.now();
        await verifyDoctorPassword(null, "wrong-password");
        const missingCaseDuration = performance.now() - startOfMissingCase;

        // 見つからない場合が、見つかる場合の 4 分の 1 未満で返るなら
        // ダミー検証が走っていない。
        expect(missingCaseDuration).toBeGreaterThan(foundCaseDuration / 4);
    });
});
```

- [ ] **Step 4: テストを実行して失敗することを確認する**

Run: `bun run --filter @repo/api test`
Expected: FAIL。`../../src/domain/doctorLogin.js` が解決できない

- [ ] **Step 5: `domain/doctorLogin.ts` を実装する**

Step 2 で生成した文字列を `dummyPasswordHash` に貼り付ける。

```ts
import { verifyPassword } from "@repo/auth/password";

// 医師が見つからない場合に検証を走らせるためのダミーハッシュ（ADR 0005 決定 5）。
// これが無いと、存在しないメールアドレスは即座に、存在するものは argon2 の
// 計算時間を経て失敗するため、応答時間でアカウントの存在が判別できる。
// router/auth.ts がメッセージを「無効なメールアドレスまたはパスワードです。」に
// 統一している配慮が、時間差で無効化されてしまう。
//
// 実在のアカウントのパスワードではない。また PHC 形式として正しい必要がある
// （不正な文字列だと verifyPassword が即座に false を返し、時間が揃わない）。
const dummyPasswordHash = "<Step 2 の出力をここへ貼る>";

// domain/ には Prisma / Hono / Next.js を import しない（ADR 0003 決定 2）。
// @repo/auth/password は I/O を持たない計算のみのため例外ではない。
export const verifyDoctorPassword = async (
    storedPasswordHash: string | null,
    plainPassword: string
): Promise<boolean> => {
    if (storedPasswordHash === null) {
        await verifyPassword(dummyPasswordHash, plainPassword);
        return false;
    }
    return verifyPassword(storedPasswordHash, plainPassword);
};
```

- [ ] **Step 6: テストを実行して通ることを確認する**

Run: `bun run --filter @repo/api test`
Expected: PASS

- [ ] **Step 7: リポジトリを平文一致からメールアドレス検索へ変える**

`packages/api/src/repository/authDoctors.ts` の全体を置き換える。

```ts
import { prisma, Prisma } from "@repo/db";

// ログイン照合のためのクエリ。移植前は email と password の平文一致だったが、
// ハッシュ化に伴い「メールアドレスで引き、ハッシュは呼び出し側で照合する」形に
// 変えた（ADR 0005 決定 5）。
//
// password を select するのはこの関数だけである。他の取得系
// （repository/doctors.ts の doctorSelect）はパスワードを一切返さない。
const doctorCredentialsSelect = {
    id: true,
    password: true,
} satisfies Prisma.doctorsSelect;

export const findDoctorByEmail = (
    email: string
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{
    select: typeof doctorCredentialsSelect;
}> | null> =>
    prisma.doctors.findFirst({
        select: doctorCredentialsSelect,
        where: { email },
    });
```

- [ ] **Step 8: `router/auth.ts` の照合と例外処理を書き換える**

import 行を差し替える。

```ts
import { findDoctorByEmail } from "../repository/authDoctors.js";
import { verifyDoctorPassword } from "../domain/doctorLogin.js";
```

`findDoctorByCredentials` を呼んでいる箇所（現行の「無効なメールアドレスまたはパスワードです。」を投げるブロック）を次に置き換える。

```ts
            // 医師が見つからない場合も verifyDoctorPassword に null を渡して
            // 検証を走らせる。早期 return すると応答時間でアカウントの存在が
            // 判別できるようになる（ADR 0005 決定 5）。
            const doctor = await findDoctorByEmail(email);
            const isPasswordValid = await verifyDoctorPassword(
                doctor?.password ?? null,
                password
            );
            if (!doctor || !isPasswordValid) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "無効なメールアドレスまたはパスワードです。",
                });
            }
```

`signDoctorToken(doctor.id, email)` はそのまま動く（`doctorCredentialsSelect` に `id` を含めている）。

同ファイルの `catch` が投げるコードを `BAD_REQUEST` から `INTERNAL_SERVER_ERROR` へ変える（ADR 0005 決定 8）。メッセージは変えない。

```ts
        } catch (error) {
            if (error instanceof TRPCError) {
                throw error;
            }
            // 想定外の失敗（DB 障害など）は 500 にする。業務ルールのエラーは
            // 上で個別の TRPCError として投げており、ここには到達しない。
            // 移植前は両者が同じ 400 に畳まれ、原因を切り分けられなかった。
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "ログインに失敗しました。",
            });
        }
```

- [ ] **Step 9: 型チェックとテストを実行する**

Run: `bun run typecheck && bun run test`
Expected: 両方成功。`findDoctorByCredentials` への参照が残っていれば型チェックで落ちる

- [ ] **Step 10: 旧関数への参照が消えたことを確認する**

Run: `grep -rn "findDoctorByCredentials" packages apps --include='*.ts' | grep -v node_modules | grep -v '/build/'`
Expected: 出力なし

- [ ] **Step 11: コミットする**

```bash
git add packages/api
git commit -m "$(cat <<'EOF'
feat: ログイン照合を argon2 のハッシュ検証へ切り替える

医師が見つからない場合もダミーハッシュに対して検証を走らせ、応答時間から
アカウントの存在が判別できないようにした。あわせてログインの想定外エラーを
400 から 500 へ変更した。

この時点ではローカル DB がまだ平文のためログインは通らない。
移行スクリプトの適用（Task 4）で復旧する。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 3: 患者の初期パスワードをハッシュ化して保存する

**Files:**
- Modify: `packages/api/src/router/patients.ts`

**Interfaces:**
- Consumes: `@repo/auth/password` の `hashPassword`（Task 1）
- Produces: なし

- [ ] **Step 1: `create` でハッシュ化してから保存する**

`packages/api/src/router/patients.ts` の import へ次を追加する。

```ts
import { hashPassword } from "@repo/auth/password";
```

`create` の `const password = derivePatientInitialPassword(birth);` を次に置き換える。

```ts
            // 導出ロジック（生年月日から YYYYMMDD）は変えず、保存時にハッシュを通す
            // （ADR 0005 決定 3）。患者のログイン経路は存在しないため照合は行われないが、
            // DB に平文の資格情報を残さないという不変条件をここで満たす。
            //
            // なおハッシュ化しても、値そのものが生年月日由来で推測可能である限界は
            // 残る。導出ロジックの見直しは患者向けの初期パスワード伝達フローを
            // 必要とするため別 Issue とした。
            const password = await hashPassword(derivePatientInitialPassword(birth));
```

- [ ] **Step 2: 型チェックとテストを実行する**

Run: `bun run typecheck && bun run test`
Expected: 両方成功

- [ ] **Step 3: コミットする**

```bash
git add packages/api
git commit -m "$(cat <<'EOF'
feat: 患者の初期パスワードをハッシュ化して保存する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 4: 既存データの移行スクリプトを作り、ローカルへ適用する

このタスクの完了時点でローカルのログインが復旧する。

**Files:**
- Create: `packages/api/scripts/hash-existing-passwords.mjs`
- Modify: `packages/api/package.json`

**Interfaces:**
- Consumes: `@repo/auth/password` の `hashPassword`（Task 1）
- Produces: なし

- [ ] **Step 1: 移行スクリプトを書く**

`packages/api/scripts/hash-existing-passwords.mjs`:

```js
// 既存の平文パスワードを argon2id のハッシュへ一括変換する（ADR 0005 決定 7）。
//
// 冪等である。既に "$argon2" で始まる値は飛ばすため、複数回実行しても
// 二重ハッシュ化しない。二重ハッシュ化されたアカウントは元のパスワードでは
// ログインできなくなり復旧不能なので、この防御は必須である。
//
// 本番（Neon）への適用は #287 の切り替えと同時に行う。それより前に適用すると
// render-legacy の平文照合が通らなくなり、本番のログインが止まる。
import { prisma } from "@repo/db";
import { hashPassword } from "@repo/auth/password";

const ARGON2_PREFIX = "$argon2";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

const connectionUrl = process.env.DATABASE_URL;
if (!connectionUrl) {
    console.error("DATABASE_URL が設定されていません。packages/api/.env を確認してください。");
    process.exit(1);
}

let hostname;
try {
    hostname = new URL(connectionUrl).hostname;
} catch {
    console.error("DATABASE_URL を URL として解釈できませんでした。");
    process.exit(1);
}

const isLocalDatabase = LOCAL_HOSTNAMES.includes(hostname);
const isExplicitlyAllowed = process.env.ALLOW_REMOTE_PASSWORD_HASHING === "1";

if (!isLocalDatabase && !isExplicitlyAllowed) {
    console.error(
        [
            "",
            `接続先がローカル DB ではありません: ${hostname}`,
            "このスクリプトは全ユーザーのパスワードを書き換えるため、実行を中止しました。",
            "",
            "本番への適用は #287（API の Vercel 統合）の切り替えと同時に行ってください。",
            "それより前に適用すると render-legacy の平文照合が通らなくなります。",
            "",
            "意図どおりであれば",
            "  ALLOW_REMOTE_PASSWORD_HASHING=1 node scripts/hash-existing-passwords.mjs",
            "として再実行してください。",
            "",
        ].join("\n")
    );
    process.exit(1);
}

if (!isLocalDatabase) {
    console.warn(`[警告] リモート DB (${hostname}) に対して実行します。`);
}

// パスワードもハッシュも出力しない。件数のみを報告する。
const hashPlaintextRows = async (label, findMany, updateById) => {
    const rows = await findMany();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
        if (row.password.startsWith(ARGON2_PREFIX)) {
            skippedCount += 1;
            continue;
        }
        await updateById(row.id, await hashPassword(row.password));
        updatedCount += 1;
    }

    console.log(`${label}: ハッシュ化 ${updatedCount} 件 / 変換済みのため据え置き ${skippedCount} 件`);
};

await hashPlaintextRows(
    "doctors",
    () => prisma.doctors.findMany({ select: { id: true, password: true } }),
    (id, password) => prisma.doctors.update({ where: { id }, data: { password } })
);

await hashPlaintextRows(
    "patients",
    () => prisma.patients.findMany({ select: { id: true, password: true } }),
    (id, password) => prisma.patients.update({ where: { id }, data: { password } })
);

await prisma.$disconnect();
```

- [ ] **Step 2: 実行用のスクリプトを `package.json` へ追加する**

`packages/api/package.json` の `scripts` へ追加する。`.env` から `DATABASE_URL` を読むため `--env-file` を付ける。

```json
    "hash-passwords": "node --env-file=.env scripts/hash-existing-passwords.mjs",
```

- [ ] **Step 3: 接続先がローカルであることを確認する**

Run:
```bash
python3 -c "
import urllib.parse, pathlib
for line in pathlib.Path('packages/api/.env').read_text().splitlines():
    if line.startswith('DATABASE_URL='):
        print('DATABASE_URL のホスト名:', urllib.parse.urlparse(line.partition('=')[2].strip().strip(chr(34))).hostname)
"
```
Expected: `localhost`。**これ以外が出たら実行せず中止する**

- [ ] **Step 4: ローカル DB が起動していることを確認する**

Run: `docker compose up -d && docker compose ps`
Expected: `patient-management-postgres` が `healthy`

- [ ] **Step 5: 移行前の平文パスワードを控えたうえでスクリプトを実行し、ログインを確認する**

移行後は DB から平文を読めなくなるため、**移行前に控えた値でログインできることを 1 つのスクリプトの中で確認する。** 値は一切出力しない。

Run:
```bash
python3 - <<'PY'
import json, subprocess, urllib.request, urllib.error, http.cookies, sys

# 1. 移行前の平文を控える（出力しない）
row = subprocess.run(
    ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "dev",
     "-d", "patient_management", "-t", "-A", "-F", "\x1f",
     "-c", "select email, password from doctors order by id limit 1"],
    capture_output=True, text=True, check=True,
).stdout.strip()
if "\x1f" not in row:
    sys.exit("doctors テーブルに行がありません。")
email, plain_password = row.split("\x1f", 1)
if plain_password.startswith("$argon2"):
    sys.exit("既にハッシュ化されています。移行は完了済みです。")
print("移行前の平文パスワードを控えた（値は出力しない）")

# 2. 移行スクリプトを実行
result = subprocess.run(["bun", "run", "hash-passwords"], cwd="packages/api",
                        capture_output=True, text=True)
print(result.stdout.strip())
if result.returncode != 0:
    sys.exit(result.stderr.strip())

# 3. DB が argon2 形式になったことを確認
after = subprocess.run(
    ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "dev",
     "-d", "patient_management", "-t", "-A",
     "-c", "select count(*) from doctors where password not like '$argon2%'"],
    capture_output=True, text=True, check=True,
).stdout.strip()
print(f"doctors のうち argon2 形式でない行: {after} 件（0 であること）")

# 4. 控えた平文でログインできることを確認
req = urllib.request.Request("http://localhost:8080/trpc/doctor.login",
    data=json.dumps({"json": {"email": email, "password": plain_password}}).encode(),
    method="POST")
req.add_header("Content-Type", "application/json")
req.add_header("Origin", "http://localhost:3000")
try:
    with urllib.request.urlopen(req) as res:
        print(f"移行後のログイン: HTTP {res.status}")
except urllib.error.HTTPError as e:
    print(f"移行後のログイン: HTTP {e.code}")
PY
```

Expected:
- `doctors: ハッシュ化 N 件 / 変換済みのため据え置き 0 件` と `patients: ...` が出る
- argon2 形式でない行が 0 件
- ログインが HTTP 200

**API サーバ（`bun run dev:api`）を起動しておくこと。** 起動していなければ手順 4 が接続エラーになる。

- [ ] **Step 6: 冪等性を確認する**

Run: `cd packages/api && bun run hash-passwords`
Expected: `doctors: ハッシュ化 0 件 / 変換済みのため据え置き N 件`。**ハッシュ化件数が 0 でなければ二重ハッシュ化しているため直ちに中止して報告する**

- [ ] **Step 7: コミットする**

```bash
git add packages/api
git commit -m "$(cat <<'EOF'
feat: 既存の平文パスワードを一括ハッシュ化するスクリプトを追加する

冪等（$argon2 で始まる値は飛ばす）で、ローカル以外への実行は
ALLOW_REMOTE_PASSWORD_HASHING=1 の明示を要求する。
本番への適用は #287 の切り替えと同時に行う。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 5: パスワードをレスポンスから除去し、更新時を任意にする

Task 3 の除去だけを先に入れるとフォームが空のパスワードを送るようになり、`hashPassword("")` で上書きされる。**除去と optional 化は同じコミットで行う。**

**Files:**
- Modify: `packages/api/src/repository/doctors.ts`
- Modify: `packages/api/src/router/doctors.ts`
- Modify: `packages/api/src/router/patients.ts`
- Modify: `packages/schema/src/types/DoctorType.ts`
- Modify: `apps/web/src/app/hooks/useDoctorEdit.ts`
- Modify: `apps/web/src/app/features/doctor/edit-doctor/EditDoctorContents.tsx`
- Test: `packages/api/test/router/doctorSchema.spec.ts`

**Interfaces:**
- Consumes: `@repo/auth/password` の `hashPassword`（Task 1）
- Produces: `router/doctors.ts` が `getDoctorSchema` を export する（テストから参照するため）

- [ ] **Step 1: 失敗するテストを書く**

`packages/api/test/router/doctorSchema.spec.ts`:

```ts
import { describe, test, expect } from "vitest";
import { getDoctorSchema } from "../../src/router/doctors.js";

// ADR 0005 決定 6。repository の select と router の出力スキーマの両方で
// パスワードを落とす二重防御のうち、後者を検証する。
//
// レスポンス全体の形の回帰テストは実 DB が要るため #288（PGlite）に委ねている。
// ここで守れるのは「出力スキーマに password を足し戻す」退行だけである。
describe("getDoctorSchema", () => {
    test("password を持つ行を parse すると password が落ちる", () => {
        const parsed = getDoctorSchema.parse({
            id: 1,
            name: "医師",
            email: "doctor@example.com",
            password: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA",
        });
        expect(parsed).not.toHaveProperty("password");
        expect(parsed).toEqual({ id: 1, name: "医師", email: "doctor@example.com" });
    });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `bun run --filter @repo/api test`
Expected: FAIL。`getDoctorSchema` が export されていない

- [ ] **Step 3: リポジトリからパスワードを外す**

`packages/api/src/repository/doctors.ts` の `doctorSelect` から `password: true` の行を削除し、コメントを追記する。

```ts
// password はここに含めない。ログイン照合に必要なハッシュは
// repository/authDoctors.ts の findDoctorByEmail だけが select する
// （ADR 0005 決定 6）。
const doctorSelect = {
    id: true,
    name: true,
    email: true,
} satisfies Prisma.doctorsSelect;
```

`updateDoctor` と `createDoctor` に `select: doctorSelect` を指定し、戻り値型を変える。あわせて `updateDoctor` の `data` の `password` を任意にする（ADR 0005 決定 4）。

```ts
// 移植前は select 未指定で全カラム（password と created_at / updated_at を含む）を
// 返していた。select を指定して返す範囲を doctorSelect に揃える（ADR 0005 決定 6）。
//
// password が undefined の場合、Prisma はそのカラムを更新しない。これが
// 「パスワードを変更しない更新」の実現手段である（ADR 0005 決定 4）。
export const updateDoctor = (
    doctorId: number,
    data: { name: string; email: string; password?: string; updated_at: Date }
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }>> =>
    prisma.doctors.update({
        where: { id: doctorId },
        data,
        select: doctorSelect,
    });

export const createDoctor = (data: {
    name: string;
    email: string;
    password: string;
}): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }>> =>
    prisma.doctors.create({ data, select: doctorSelect });
```

- [ ] **Step 4: ルータの出力スキーマと入出力を書き換える**

`packages/api/src/router/doctors.ts`:

import へ次を追加する。

```ts
import { hashPassword } from "@repo/auth/password";
```

`baseDoctorSchema` から `password` を外し、`getDoctorSchema` を export する。

```ts
// password は出力スキーマに含めない。含めると repository が返さなくなっても
// 型の上では「返る」ことになり、将来 select を戻したときに素通しする
// （ADR 0005 決定 6）。
const baseDoctorSchema = {
    name: z.string(),
    email: z.string(),
};

// テストから参照するため export する（test/router/doctorSchema.spec.ts）。
export const getDoctorSchema = z.object({
    ...baseDoctorSchema,
    id: z.number(),
});

const getDoctorsSchema = z.array(getDoctorSchema);

const createDoctorSchema = z.object({
    ...baseDoctorSchema,
    password: z.string(),
});

const updateDoctorSchema = z.object({
    ...baseDoctorSchema,
    password: z.string().optional(),
    updated_at: z.date(),
});
```

`update` の入力の `password` を optional にし、渡されたときだけハッシュ化する。

```ts
    update: protectedProcedure
        .input(
            z.object({
                doctorId: z.number(),
                name: z.string(),
                email: z.string(),
                // 空欄ならパスワードを変更しない（ADR 0005 決定 4）。
                // パスワードを返さなくなったため、フォームが現在値を送り返す
                // 従来の形は成立しない。
                password: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const { doctorId, name, email, password } = input;
            const updated_at: Date = new Date();

            const parsedData:
                | {
                      success: true;
                      data: UpdateDoctorSchema;
                  }
                | {
                      success: false;
                      error: ZodError;
                  } = updateDoctorSchema.safeParse({
                name,
                email,
                updated_at,
                // undefined を渡すと Prisma はそのカラムを更新しない。
                ...(password !== undefined && { password: await hashPassword(password) }),
            });
```

以降の `if (!parsedData.success)` から `catch` までは変更しない。

`create` はハッシュ化を挟み、`{ data: result }` の包みを外す。

```ts
            try {
                const parsedInput = { ...parsedData.data, password: await hashPassword(parsedData.data.password) };
                return await createDoctor(parsedInput);
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの保存に失敗しました。",
                });
            }
```

- [ ] **Step 5: 患者の create / update の戻り値を整形する**

`packages/api/src/router/patients.ts` の `create` の `return await createPatient(validatedData);` を次に置き換える。

```ts
                // 未 parse で返すと password と created_at / updated_at まで
                // クライアントへ渡る（ADR 0005 決定 6）。
                return getPatientSchema.parse(await createPatient(validatedData));
```

同ファイルの `update` の `return await updatePatient(id, validatedData);` を次に置き換える。

```ts
                return getPatientSchema.parse(await updatePatient(id, validatedData));
```

- [ ] **Step 6: `DoctorType` から `password` を外す**

`packages/schema/src/types/DoctorType.ts`:

```ts
export type DoctorType = {
    id: number;
    name: string;
    email: string;
}
```

- [ ] **Step 7: 型チェックを実行し、フロントの参照が壊れることを確認する**

Run: `bun run typecheck`
Expected: FAIL。`apps/web/src/app/hooks/useDoctorEdit.ts` の `doctorData.password` が `DoctorType` に存在しないという型エラーが出る。**これは意図どおりで、型が消し忘れを検出している**

- [ ] **Step 8: フロントのプリフィルとバリデーションを直す**

`apps/web/src/app/hooks/useDoctorEdit.ts`。

`setValues` から `password` を外す。

```ts
    useEffect(() => {
        if (doctorData) {
            // password はサーバから返らなくなった（ADR 0005 決定 6）。
            // 更新時は空欄のままにし、入力があったときだけ送る。
            form.setValues({
                name: doctorData.name,
                email: doctorData.email,
            })
        }
    }, [doctorData])
```

バリデーションを新規作成時のみ必須にする。

```ts
            // 更新時のパスワードは任意。空欄なら変更しない（ADR 0005 決定 4）。
            password: (value) => {
                if (id) {
                    return null;
                }
                return value === "" && "パスワードを入力してください。";
            },
```

送信時は空欄なら送らない。

```ts
        try {
            if (id) {
                await trpcClient.doctor.doctors.update.mutate({
                    doctorId: id,
                    name,
                    email,
                    // 空欄はパスワードを変更しないという意味なので送らない。
                    // 空文字を送るとサーバがそれをハッシュ化して上書きしてしまう。
                    ...(password !== "" && { password }),
                });
            } else {
                await trpcClient.doctor.doctors.create.mutate({ name, email, password });
            }
        } catch (error) {
```

- [ ] **Step 9: 入力欄の表示を更新時と新規作成時で出し分ける**

`apps/web/src/app/features/doctor/edit-doctor/EditDoctorContents.tsx` のパスワード欄を次に置き換える。`htmlFor` が `"name"` になっている誤りもここで直す。

```tsx
              <label htmlFor="password" className={styles.label}>
                パスワード{!id && <span style={{ color: "red" }}>*</span>}
              </label>
              <PasswordInput
                id="password"
                placeholder={
                  id ? "変更する場合のみ入力してください。" : "パスワードを入力してください。"
                }
                required={!id}
                className={styles.input}
                value={form.values.password}
                {...form.getInputProps("password")}
                error={form.errors.password}
              />
```

- [ ] **Step 10: 型チェックとテストを実行する**

Run: `bun run typecheck && bun run test`
Expected: 両方成功

- [ ] **Step 11: 画面で動作を確認する**

Run: `bun run dev`

1. ログインする
2. 医師一覧 → 自分の編集画面を開く。**パスワード欄が空で、必須マークが無く、「変更する場合のみ入力してください。」と表示される**
3. パスワードを空欄のまま名前だけ変えて更新する → 成功する
4. 一度ログアウトし、**元のパスワードでログインできる**（空欄の更新でパスワードが壊れていないことの確認）
5. 再度編集画面でパスワードを新しい値に変えて更新する
6. ログアウトし、**新しいパスワードでログインできる**。**古いパスワードではログインできない**
7. 医師を新規作成する → パスワードが必須で、作成後にそのパスワードでログインできる

- [ ] **Step 12: レスポンスにパスワードが含まれないことを確認する**

Step 11 のブラウザ操作を続けたまま、開発者ツールの Network タブで確認する。tRPC は
`httpBatchLink` で複数の query を 1 リクエストへまとめるため、**個別のリクエストではなく
バッチされたレスポンスの中身を見る**（#307 参照）。

1. 医師一覧の画面を開き、`doctor.doctors.list` を含むレスポンスを開く。返る各要素が
   `id` / `name` / `email` の 3 つだけで、**`password` が無い**ことを確認する
2. 同じレスポンスに含まれる `doctor.loginDoctor` にも `password` が無いことを確認する
3. 医師の編集画面を開き、`doctor.doctors.byId` のレスポンスに `password` が無いことを確認する
4. 患者を 1 件新規作成し、`doctor.patients.create` のレスポンスに `password` が無いことを
   確認する。あわせて `created_at` / `updated_at` も落ちている（ADR 0005 波及）
5. 医師を 1 件新規作成し、`doctor.doctors.create` のレスポンスに `password` が無く、
   `{ data: ... }` の包みも外れていることを確認する

**いずれかに `password` が現れた場合は実装が不完全なので、コミットせずに報告する。**

- [ ] **Step 13: コミットする**

```bash
git add packages apps
git commit -m "$(cat <<'EOF'
feat: パスワードをレスポンスから除去し、更新時を任意にする

repository の select と router の出力スキーマの両方で落とす二重防御にした。
DoctorType から password を外したことで、フロントの参照は型エラーとして
検出される。更新時にパスワードを送らなければ変更しない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

---

### Task 6: 完了確認と Issue / PR の更新

**Files:**
- Create: `docs/adr/0005-password-hashing.md` は作成済み・未コミット。このタスクでコミットする

**Interfaces:**
- Consumes: Task 1〜5 の成果
- Produces: なし

- [ ] **Step 1: ADR をコミットする**

```bash
git add docs/adr/0005-password-hashing.md docs/superpowers/plans/2026-09-05-password-hashing.md
git commit -m "$(cat <<'EOF'
docs: ADR 0005 としてパスワードのハッシュ化の設計を記録する

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
EOF
)"
```

- [ ] **Step 2: 全体の検証をやり直す**

Run: `bun run typecheck && bun run test && bun run build`
Expected: 3 つともエラーなく終了

- [ ] **Step 3: 平文のパスワードが DB に残っていないことを確認する**

Run:
```bash
docker compose exec -T postgres psql -U dev -d patient_management -c "
select 'doctors' as table_name, count(*) as plaintext_rows from doctors where password not like '\$argon2%'
union all
select 'patients', count(*) from patients where password not like '\$argon2%';"
```
Expected: 両方とも `0`

- [ ] **Step 4: パスワードを返す経路が残っていないことを確認する**

Run: `grep -rn "password" packages/api/src/repository/ packages/schema/src/types/DoctorType.ts`
Expected: `repository/authDoctors.ts` の `doctorCredentialsSelect` のみがヒットする。`repository/doctors.ts` と `DoctorType.ts` からは消えている

- [ ] **Step 5: #287 へ本番適用の項目を追加する（要・利用者の承認）**

**GitHub 上の Issue を書き換える外向きの操作である。実行前に利用者へ確認を取ること。**

#287 の「やること」へ次の 2 行を追加する。

```
- [ ] 本番 DB のパスワードを一括ハッシュ化する（`ALLOW_REMOTE_PASSWORD_HASHING=1 bun run hash-passwords`。Render 停止と同時。ADR 0005 決定 2・7）
- [ ] `@node-rs/argon2` の linux-x64 バイナリが Vercel 上で解決されることを確認する（失敗するとログインが動かない。ADR 0005 波及）
```

- [ ] **Step 6: スコープ外の 3 件を Issue として起票する（要・利用者の承認）**

**外向きの操作である。実行前に利用者へ確認を取ること。** ADR 0005「スコープ外」に記録した 3 件。

1. `doctors.update` に所有者チェックが無い（ログインしていれば他の医師のパスワードも変更できる。UI は自分自身のみ表示するが API は制限していない）
2. 患者の初期パスワードが生年月日から推測可能（修正には患者向けの初期パスワード伝達フローが必要）
3. ログイン API にレート制限が無い

- [ ] **Step 7: PR を作成する（要・利用者の承認）**

**外向きの操作である。実行前に利用者へ確認を取ること。**

PR の本文には次を含める。

- ADR 0005 へのリンク
- 着手時に判明した「漏洩経路は 1 つではなく 7 つだった」こと
- 本番データの一括ハッシュ化を #287 へ委ねたこと、およびその理由（`render-legacy` が平文照合を行うため）
- `@node-rs/argon2` のプラットフォーム別バイナリが #287 のリスクであること
- **`Closes #286`** を含める（第 2 フェーズの完了により Issue が閉じる）
- 末尾に次の 2 行

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Pzpc442muwnNiLfmFKgDvZ
```

---

## 実装後に残る既知の状態

計画どおり完了しても次は解消しない。いずれも意図的な先送りである。

- **本番 Neon のパスワードは平文のまま。** #287 の切り替えと同時に適用する（ADR 0005 決定 2）
- **レスポンスの形の回帰テストが無い。** 経路ごとの検証には実 DB が要り、PGlite は #288 の担当。守れているのは `getDoctorSchema` の単体テストと Step 12 の目視確認だけ（ADR 0005 波及）
- **`usePatientEdit.ts` の `password` は死んだフォーム項目である。** `initialValues` に `...!id && { password: "" }` があるが、患者作成の tRPC 入力に `password` は無く、画面にも入力欄が描画されていない。**本計画では触らない**——患者のハッシュ化は API 側だけで完結し、このファイルを編集する必要がないため。別途片付ける
- **`doctors.update` の所有者チェックが無い。** Step 6 で起票する
- **患者の初期パスワードが推測可能である。** Step 6 で起票する
- **ログイン API にレート制限が無い。** Step 6 で起票する
