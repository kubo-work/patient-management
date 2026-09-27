// API の出力の型はここに置かない。web は tRPC の推論から得る（apps/web/src/lib/trpc.ts）。
// ここに置くのは、API と web の両方が実行時に値として使う定数と、そこから導く型だけにする。
export type { SexListData } from "./types/SexListData.js";
export type { SexTypes } from "./types/SexTypes.js";

export { doctorCookieName } from "./util/CookieName.js";
export { sexList } from "./util/SexList.js";
export {
    doctorSortColumns,
    isPageSize,
    medicalRecordSortColumns,
    pageSizeOptions,
    patientSortColumns,
    sortOrders,
} from "./util/Pagination.js";
export type {
    DoctorSortColumn,
    MedicalRecordSortColumn,
    PageRequest,
    PageSize,
    PatientSortColumn,
    SortOrder,
} from "./util/Pagination.js";
