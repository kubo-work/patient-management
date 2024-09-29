import { CategoriesType } from "./CategoriesType";

type MedicalCategoriesType = {
    categories: Pick<CategoriesType, "treatment">;
}

export type MedicalRecordsType = {
    id: number;
    patient_id: number;
    examination_at: Date;
    medical_categories: MedicalCategoriesType[]
}
