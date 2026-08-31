import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { sexList } from "@repo/schema";
import { router, protectedProcedure } from "../trpc/init.js";
import { derivePatientInitialPassword } from "../domain/patientPassword.js";
import { createPatient, findAllPatients, findPatientById, updatePatient } from "../repository/patients.js";

// sexList のキーから zod の enum を組み立てる。値は参照せずキーだけを使うため
// unknown で受ける。@repo/schema に置かないのは、schema パッケージを zod に
// 依存させないため。domain/ に置かないのは、業務ルールではなく zod の
// 組み立てヘルパーであり ADR 0003 決定 2 の「domain は純粋な業務ロジック」に
// あたらないため。利用は下の basePatientSchemaObject 1 箇所のみなので同居させる。
const zodEnumFromObjKeys = <K extends string>(
    obj: Record<K, unknown>,
): z.ZodEnum<[K, ...K[]]> => {
    const [firstKey, ...otherKeys] = Object.keys(obj) as K[];
    if (typeof firstKey !== "string") throw new Error("key is not string");
    return z.enum([firstKey, ...otherKeys]);
};

// Prisma から返るデータ（getPatientSchema.parse など）と、確定した
// 更新・登録データ（updatePatientSchema.parse / createPatientSchema.parse）を
// 検証する基本形。移植前の doctor/patients.ts の basePatientSchemaObject を
// そのまま移した。superjson により birth は tRPC の境界で既に Date に
// 復元されているため、移植前にあった z.string().transform(Date 化) は不要になる
// （ADR 0003 決定 6）。
const basePatientSchemaObject = {
    name: z.string(),
    email: z.string(),
    tel: z.string(),
    sex: zodEnumFromObjKeys(sexList),
    address: z.string(),
    birth: z.date(),
};

const getPatientSchema = z.object({
    ...basePatientSchemaObject,
    id: z.number(),
});

const getPatientsSchema = z.array(getPatientSchema);

const createPatientSchema = z.object({
    ...basePatientSchemaObject,
    password: z.string(),
});

const updatePatientSchema = z.object({
    ...basePatientSchemaObject,
    updated_at: z.date(),
});

type CreatePatientSchema = z.infer<typeof createPatientSchema>;
type UpdatePatientSchema = z.infer<typeof updatePatientSchema>;

export const patientsRouter = router({
    list: protectedProcedure.query(async () => {
        try {
            return getPatientsSchema.parse(await findAllPatients());
        } catch {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "データの取得に失敗しました。",
            });
        }
    }),

    byId: protectedProcedure
        .input(z.object({ patientId: z.number() }))
        .query(async ({ input }) => {
            try {
                const patient = await findPatientById(input.patientId);
                // patient が null の場合。tRPC は return ではなく throw で
                // エラーを伝える必要があるため、この throw が下の catch に
                // 再度捕まらないよう instanceof TRPCError で弾き直している
                // （router/doctors.ts の byId と同じ形）。
                if (!patient) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "指定された患者が見つかりません。",
                    });
                }
                return getPatientSchema.parse(patient);
            } catch (error) {
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの取得に失敗しました。",
                });
            }
        }),

    // .input() は緩い型（sex は z.string()）に留め、sexList に基づく厳密な
    // 検証は updatePatientSchema.parse に任せている。移植前の
    // doctor/patients.ts の PUT /:patient_id は「JSON パース・zod 検証・
    // Prisma 呼び出し」を 1 つの try/catch にまとめ、失敗は全て同じ
    // 「データの更新に失敗しました。」1 メッセージへ落としていた。
    // sex を .input() の時点で zodEnumFromObjKeys により厳密検証すると、
    // 不正な値は tRPC 標準のエラー（このメッセージとは別物）で弾かれてしまい、
    // 移植前の「原因によらず単一メッセージ」という挙動が壊れる。
    // そのため router/doctors.ts の update と同様に .input() を緩め、
    // 業務的な検証は try の中で行う二段構えにした。
    //
    // id は移植前から URL の patient_id ではなくボディの id で更新している。
    // 整理は本 Issue の範囲外のためこの挙動を変えない。
    update: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string(),
                email: z.string(),
                tel: z.string(),
                sex: z.string(),
                address: z.string(),
                birth: z.date(),
            })
        )
        .mutation(async ({ input }) => {
            const { id, name, sex, tel, email, address, birth } = input;
            const updated_at: Date = new Date();

            try {
                const validatedData: UpdatePatientSchema = updatePatientSchema.parse({
                    name,
                    sex,
                    tel,
                    email,
                    address,
                    birth,
                    updated_at,
                });
                return await updatePatient(id, validatedData);
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの更新に失敗しました。",
                });
            }
        }),

    // update と同じ理由で .input() は緩め、sexList に基づく検証は
    // createPatientSchema.parse に任せる。password は生年月日から導出する
    // （移植前のハンドラ内の 1 行を domain/patientPassword.ts へ切り出した）。
    create: protectedProcedure
        .input(
            z.object({
                name: z.string(),
                email: z.string(),
                tel: z.string(),
                sex: z.string(),
                address: z.string(),
                birth: z.date(),
            })
        )
        .mutation(async ({ input }) => {
            const { name, sex, tel, email, address, birth } = input;
            const password = derivePatientInitialPassword(birth);

            try {
                const validatedData: CreatePatientSchema = createPatientSchema.parse({
                    name,
                    sex,
                    tel,
                    email,
                    address,
                    birth,
                    password,
                });
                return await createPatient(validatedData);
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの登録に失敗しました。",
                });
            }
        }),
});
