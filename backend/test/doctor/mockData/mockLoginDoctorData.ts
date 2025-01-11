import { DoctorType } from "../../../../common/types/DoctorType";
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
const { sign } = jwt;

export type mockDoctorsData = DoctorType & {
    created_at: Date;
    updated_at: Date;
};

// モックデータの生成
export const mockSetDoctorData: mockDoctorsData[] = Array.from({ length: 3 }, () => (
    {
        id: faker.number.int({ min: 1000, max: 9999 }),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        created_at: faker.date.between({ from: new Date("2000-01-01"), to: new Date() }),
        updated_at: faker.date.between({ from: new Date("2000-01-01"), to: new Date() })
    }
));

export const testToken = sign({ userId: mockSetDoctorData[0].id, email: mockSetDoctorData[0].email }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });



