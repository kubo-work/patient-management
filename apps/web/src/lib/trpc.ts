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
