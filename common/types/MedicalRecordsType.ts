import { BasicCategoriesType } from "./BasicCategoriesType";

export type MedicalRecordsType = {
    id: number;
    patient_id: number;
    medical_memo: string;
    doctor_memo: string;
    examination_at: Date;
    categories: BasicCategoriesType[]
}
