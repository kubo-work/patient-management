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
        // argon2Options は渡さない。検証時のコストパラメータは PHC 文字列
        // （$argon2id$v=19$m=...,t=...,p=...$salt$hash）に埋まっており、
        // 引数で渡しても無視される。渡すと「argon2Options を変えると既存ハッシュの
        // 検証が壊れる」と読めてしまうが、実際は逆で、パラメータを引き上げても
        // 既存ハッシュはそれ自身に書かれた値で検証を通る。それが PHC 形式の利点である。
        return await verify(storedPasswordHash, plainPassword);
    } catch {
        return false;
    }
};
