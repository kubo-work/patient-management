import { DoctorType } from "../../../../common/types/DoctorType";

export type mockDoctorsData = DoctorType & {
    created_at: Date;
    updated_at: Date;
};

export const mockSetDoctorData: mockDoctorsData =
{
    id: 1,
    name: 'テスト太郎',
    email: 'test@example.com',
    password: "test",
    created_at: new Date(),
    updated_at: new Date()
}
