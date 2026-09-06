import { Prisma } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import { hashPassword } from "@repo/auth/password";
import { router, protectedProcedure } from "../trpc/init.js";
import { createDoctor, findAllDoctors, findDoctorById, updateDoctor } from "../repository/doctors.js";

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

// 更新時のパスワードは任意。空欄なら変更しないという意味になる
// （ADR 0005 決定 4）。
const updateDoctorSchema = z.object({
    ...baseDoctorSchema,
    password: z.string().optional(),
    updated_at: z.date(),
});

type CreateDoctorSchema = z.infer<typeof createDoctorSchema>;
type UpdateDoctorSchema = z.infer<typeof updateDoctorSchema>;

export const doctorsRouter = router({
    list: protectedProcedure.query(async () => {
        try {
            return getDoctorsSchema.parse(await findAllDoctors());
        } catch {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "データの取得に失敗しました。",
            });
        }
    }),

    byId: protectedProcedure
        .input(z.object({ doctorId: z.number() }))
        .query(async ({ input }) => {
            try {
                const doctor = await findDoctorById(input.doctorId);
                // doctor が null の場合。tRPC は return ではなく throw で
                // エラーを伝える必要があるため、この throw が下の catch に
                // 再度捕まらないよう instanceof TRPCError で弾き直している。
                if (!doctor) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "指定された医師が見つかりません。",
                    });
                }
                return getDoctorSchema.parse(doctor);
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

    // #284 で追加した認可（ADR 0002 決定 7）。移植前はこの PUT だけ認可が
    // 無く、トークン無しで任意の医師のパスワードを書き換えられた。
    // publicProcedure にすると塞いだ穴が再び開くため必ず protectedProcedure。
    update: protectedProcedure
        .input(
            z.object({
                doctorId: z.number(),
                name: z.string(),
                email: z.string(),
                // 渡されなければパスワードを変更しない（ADR 0005 決定 4）。
                // パスワードを返さなくなったため、フォームが現在値を送り返す
                // 従来の形は成立しない。
                //
                // min(1) を付けて空文字を弾く。「変更しない」はクライアント側では
                // 空文字、サーバ側では undefined で表されており、その変換を
                // useDoctorEdit.ts が担っている。変換が壊れて空文字が届いた場合に
                // ハッシュ化した空文字で上書きされると、そのアカウントは
                // ログインできなくなる。型では防げないのでここで拒否する。
                password: z.string().min(1).optional(),
            })
        )
        .mutation(async ({ input }) => {
            const { doctorId, name, email, password } = input;
            // 移植前は updated_at をハンドラ内で作って zod に通していた。
            // その扱いをそのまま保つ。
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
                // undefined のまま渡すと Prisma はそのカラムを更新しない。
                ...(password !== undefined && { password: await hashPassword(password) }),
            });
            if (!parsedData.success) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "入力データが不正です。",
                });
            }

            try {
                return await updateDoctor(doctorId, parsedData.data);
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "指定された医師が見つかりません。",
                    });
                }
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの更新に失敗しました。",
                });
            }
        }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string(),
                email: z.string(),
                // update と揃えて空文字を弾く。片方だけ厳しいと、どちらが
                // 正しい契約なのかが読み取れなくなる。
                password: z.string().min(1),
            })
        )
        .mutation(async ({ input }) => {
            const parsedData:
                | {
                      success: true;
                      data: CreateDoctorSchema;
                  }
                | {
                      success: false;
                      error: ZodError;
                  } = createDoctorSchema.safeParse(input);
            if (!parsedData.success) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "入力データが不正です。",
                });
            }

            try {
                // 戻り値は createDoctor 側の select により doctorSelect に揃う。
                // 移植前の { data: result } という包みは、他の procedure と
                // 形を揃えるため外した（ADR 0005 波及）。
                return await createDoctor({
                    ...parsedData.data,
                    password: await hashPassword(parsedData.data.password),
                });
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの保存に失敗しました。",
                });
            }
        }),
});

// protectedProcedure の middleware（trpc/init.ts）を通過しているため
// ctx.doctorId は必ず number に絞り込まれている。
export const loginDoctorProcedure = protectedProcedure.query(async ({ ctx }) => {
    try {
        const doctor = await findDoctorById(ctx.doctorId);
        if (!doctor) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "指定された医師が見つかりません。",
            });
        }
        return getDoctorSchema.parse(doctor);
    } catch (error) {
        if (error instanceof TRPCError) {
            throw error;
        }
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "データの取得に失敗しました。",
        });
    }
});
