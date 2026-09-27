import type { sexList } from "../util/SexList.js";

// 性別の型は sexList から導き、定義を 1 箇所にする。
export type SexTypes = typeof sexList;
