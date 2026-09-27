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
type QueryOutput<Procedure extends { query: (...args: never[]) => Promise<unknown> }> =
    Awaited<ReturnType<Procedure["query"]>>;

export type PatientType = QueryOutput<typeof trpcClient.doctor.patients.byId>;
export type PatientListItemType = QueryOutput<typeof trpcClient.doctor.patients.page>["items"][number];
// loginDoctor / doctors.list / doctors.page も同じ出力スキーマ（getDoctorSchema）で返すため、
// この型を共有する。形が食い違えば、代入する箇所で型エラーになる。
export type DoctorType = QueryOutput<typeof trpcClient.doctor.doctors.byId>;
export type MedicalRecordType = QueryOutput<typeof trpcClient.doctor.medicalRecords.page>["items"][number];
export type CategoryType = QueryOutput<typeof trpcClient.doctor.categories.list>[number];
