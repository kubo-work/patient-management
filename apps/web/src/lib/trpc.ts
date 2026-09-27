import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
// 値として import すると Prisma がブラウザ向けにバンドルされてビルドが壊れる。
// 必ず import type にすること（ADR 0003 波及）。
import type { AppRouter } from "@repo/api";
import { API_URL } from "../../constants/url";

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${API_URL}/trpc`,
            transformer: superjson,
            // Cookie を送るために必要。REST 時代の fetch と同じ。
            fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
        }),
    ],
});

// API の出力の型は、router の zod スキーマから tRPC が推論したものを使う。
// @repo/schema に同じ形を書き直すと、定義が 2 箇所になり食い違いうるため。
// inferRouterOutputs は @trpc/server にしか無いため、クライアントの戻り値から導く。
type PatientsPage = Awaited<ReturnType<typeof trpcClient.doctor.patients.page.query>>;
export type PatientListItemType = PatientsPage["items"][number];
