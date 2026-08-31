import jwt, { type JwtPayload } from "jsonwebtoken";
import { secretKey } from "../jwt_secret_key.js";

const { sign, verify } = jwt;

interface DoctorJwtPayload extends JwtPayload {
    userId: string; // JWT のペイロードに userId を持たせている
}

// 呼び出し側が HTTP（Hono ミドルウェア）と RPC（tRPC の procedure）の 2 つあり、
// エラーの表現方法が異なる。ここではステータスコードもメッセージも持たず、
// 失敗の理由だけを返して、表現は呼び出し側に委ねる。
//
// secret-missing と invalid を分けているのは、移植前の requireDoctor が
// 前者を 401（Cookie 削除つき）、後者を 403 として区別していたため。
// 1 つに潰すと振る舞いが変わる。
export type DoctorTokenResult =
    | { ok: true; doctorId: number }
    | { ok: false; reason: "secret-missing" | "invalid" };

export const verifyDoctorToken = (token: string): DoctorTokenResult => {
    if (!secretKey) {
        return { ok: false, reason: "secret-missing" };
    }
    try {
        const decoded = verify(token, secretKey);
        if (typeof decoded !== "object") {
            return { ok: false, reason: "invalid" };
        }
        return { ok: true, doctorId: Number((decoded as DoctorJwtPayload).userId) };
    } catch {
        return { ok: false, reason: "invalid" };
    }
};

// 秘密鍵が無ければ発行できない。呼び出し側が「トークンの設定が無効です。」を
// 返せるよう null を返す。
export const signDoctorToken = (userId: number, email: string): string | null => {
    if (!secretKey) {
        return null;
    }
    return sign({ userId, email }, secretKey, { expiresIn: "1d" });
};
