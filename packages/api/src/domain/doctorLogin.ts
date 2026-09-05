import { verifyPassword } from "@repo/auth/password";

// 医師が見つからない場合に検証を走らせるためのダミーハッシュ（ADR 0005 決定 5）。
// これが無いと、存在しないメールアドレスは即座に、存在するものは argon2 の
// 計算時間を経て失敗するため、応答時間でアカウントの存在が判別できる。
// router/auth.ts がメッセージを「無効なメールアドレスまたはパスワードです。」に
// 統一している配慮が、時間差で無効化されてしまう。
//
// 実在のアカウントのパスワードではない（固定文字列から生成したもの）。また PHC 形式
// として正しい必要がある。不正な文字列だと verifyPassword が例外を握って即座に
// false を返し、時間が揃わないまま対策が無意味になる。
const dummyPasswordHash =
    "$argon2id$v=19$m=19456,t=2,p=1$lkeR4sLXYbE3+4dcLo7U6Q$WWfImadfvXHfL1CZuvtP6xMX11Gm2hUxXlbT+kPcV+A";

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
