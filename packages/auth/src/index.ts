// secret.ts は export しない。秘密鍵そのものを外へ出す必要がなく、
// 読み込み時 throw の副作用だけが token.ts 経由で伝わればよい。
export { signDoctorToken, verifyDoctorToken } from "./token.js";
export type { DoctorTokenResult } from "./token.js";
