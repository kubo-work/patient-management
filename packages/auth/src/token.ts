import { SignJWT, jwtVerify } from "jose";
import { doctorTokenSecret } from "./secret.js";

// 呼び出し側は tRPC の procedure（@repo/api）と Next.js の proxy（apps/web）の 2 つで、
// エラーの表現方法が異なる。ここではステータスコードもメッセージも持たず、
// 成否だけを返して表現は呼び出し側へ委ねる。
//
// 失敗の理由を持たないのは、秘密鍵の欠落が secret.ts の throw によって
// 到達不能になったため（ADR 0004 決定 3）。残る失敗は「検証を通らない」の 1 つだけ。
export type DoctorTokenResult = { ok: true; doctorId: number } | { ok: false };

// jsonwebtoken のデフォルトと同じ HS256 を維持する。これにより発行済みのトークンが
// そのまま検証を通り、ライブラリの入れ替えで強制ログアウトが起きない（ADR 0004 決定 1）。
const signingAlgorithm = "HS256";

const doctorTokenLifetime = "1d";

// ペイロードのクレーム名 userId は移植前から変えない。変えると発行済みの
// トークンが検証を通らなくなる。
export const signDoctorToken = async (doctorId: number, email: string): Promise<string> =>
    new SignJWT({ userId: doctorId, email })
        .setProtectedHeader({ alg: signingAlgorithm })
        .setIssuedAt()
        .setExpirationTime(doctorTokenLifetime)
        .sign(doctorTokenSecret);

export const verifyDoctorToken = async (token: string): Promise<DoctorTokenResult> => {
    try {
        // algorithms を明示しないと、ヘッダの alg をそのまま信用する余地が残る。
        const { payload } = await jwtVerify(token, doctorTokenSecret, {
            algorithms: [signingAlgorithm],
        });

        const doctorId = Number(payload.userId);
        // userId が無いトークンでは Number(undefined) が NaN になり、そのまま
        // doctorId として通過してしまう。移植前の実装が持っていた穴をここで塞ぐ。
        if (!Number.isInteger(doctorId)) {
            return { ok: false };
        }

        return { ok: true, doctorId };
    } catch {
        return { ok: false };
    }
};
