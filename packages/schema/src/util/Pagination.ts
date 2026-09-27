// 一覧 API（doctor.*.page）の入力で受け付ける値。API の zod 検証と画面の選択肢の両方がこれを参照し、
// 片方だけ変えて食い違うことを防ぐ。
export const pageSizeOptions = [10, 20, 50] as const;
export type PageSize = (typeof pageSizeOptions)[number];

export const isPageSize = (value: number): value is PageSize =>
    (pageSizeOptions as readonly number[]).includes(value);

export const sortOrders = ["asc", "desc"] as const;
export type SortOrder = (typeof sortOrders)[number];

// 一覧 API の入力。page は 1 始まり。
export type PageRequest<SortColumn extends string> = {
    page: number;
    pageSize: PageSize;
    sortBy: SortColumn;
    sortOrder: SortOrder;
};

// 一覧ごとにソートを許可する列。画面の列 ID と API の sortBy は同じ文字列を使う。
export const patientSortColumns = ["id", "name", "sex", "address"] as const;
export type PatientSortColumn = (typeof patientSortColumns)[number];

export const doctorSortColumns = ["id", "name", "email"] as const;
export type DoctorSortColumn = (typeof doctorSortColumns)[number];

export const medicalRecordSortColumns = ["id", "examination_at"] as const;
export type MedicalRecordSortColumn = (typeof medicalRecordSortColumns)[number];
