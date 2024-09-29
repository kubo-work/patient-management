import { BasicCategoriesType } from "./BasicCategoriesType";

type MedicalCategoriesType = {
    categories: Pick<BasicCategoriesType, "treatment">;
}

export type MedicalRecordsType = {
    id: number;
    patient_id: number;
    examination_at: Date;
    medical_categories: MedicalCategoriesType[]
}
