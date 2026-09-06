import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { publicProcedure } from "../trpc/init.js";
import { signDoctorToken } from "@repo/auth";
import { doctorCookieAttributes, DOCTOR_COOKIE_MAX_AGE_SECONDS } from "../doctor_cookie.js";
import { findDoctorByEmail } from "../repository/authDoctors.js";
import { verifyDoctorPassword } from "../domain/doctorLogin.js";

// Cookie を発行・削除するため publicProcedure（認可の対象外）。
// protectedProcedure にすると「ログインするために先にログインが必要」になる。

// 移植前の doctor/login.ts は JSON パース・空チェック・Prisma 呼び出し・
// トークン発行を 1 つの try/catch にまとめ、想定外のエラーは全て
// 「ログインに失敗しました。」1 メッセージへ畳んでいた。業務ルールの
// エラー（空チェック・不一致・鍵未設定）は個別の TRPCError として投げ、
// catch では instanceof TRPCError で再送出することで、この二段構えを保つ
// （router/patients.ts の byId と同じ形）。
export const loginProcedure = publicProcedure
    .input(z.object({ email: z.string(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
        const { email, password } = input;
        try {
            if (!email) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "メールアドレスが入力されていません。",
                });
            }
            if (!password) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "パスワードが入力されていません。",
                });
            }

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

            const token = await signDoctorToken(doctor.id, email);

            setCookie(ctx.honoContext, doctorCookieName, token, {
                ...doctorCookieAttributes,
                maxAge: DOCTOR_COOKIE_MAX_AGE_SECONDS,
            });

            return { message: "ログインに成功しました。" };
        } catch (error) {
            if (error instanceof TRPCError) {
                throw error;
            }
            // 想定外の失敗（DB 障害など）は 500 にする。業務ルールのエラーは
            // 上で個別の TRPCError として投げており、ここには到達しない。
            // 移植前は両者が同じ 400 に畳まれ、原因を切り分けられなかった
            // （ADR 0005 決定 8）。
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "ログインに失敗しました。",
            });
        }
    });

// express-session のセッション破棄は移植前の doctor/logout.ts の時点で既に
// 実質的に無かった（sessionId / userId に値を書き込むコードが無く、常に空の
// セッションを破棄していただけ）。レスポンスは移植前と同じ文字列。
//
// 戻り値は移植前と同じ文字列 "ログアウトしました。" だが、移植前は
// context.text() で text/plain として返していたのに対し、tRPC は常に JSON を
// 返すため実際のレスポンスボディは JSON 文字列（"\"ログアウトしました。\""）になる。
// フロントは本文を読んでいないため実害はない（報告書に記載）。
export const logoutProcedure = publicProcedure.mutation(async ({ ctx }) => {
    deleteCookie(ctx.honoContext, doctorCookieName, doctorCookieAttributes);
    return "ログアウトしました。";
});
