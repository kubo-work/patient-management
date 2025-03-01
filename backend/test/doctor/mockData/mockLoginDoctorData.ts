import { DoctorType } from "../../../../common/types/DoctorType";
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { secretKey } from "../../../src/jwt_secret_key";
const { sign } = jwt;

export type mockDoctorsData = DoctorType & {
    created_at: Date;
    updated_at: Date;
};

// モックデータの生成
export const mockSetDoctorData = Array.from({ length: 3 }, (_, index) => ({
    id: faker.number.int({ min: 1000, max: 9999 }),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    created_at: faker.date.between({ from: new Date("2000-01-01"), to: new Date() }),
    updated_at: faker.date.between({ from: new Date("2000-01-01"), to: new Date() })
}));

export const testToken = secretKey ? sign({ userId: mockSetDoctorData[0].id, email: mockSetDoctorData[0].email }, secretKey, { expiresIn: "1d" }) : "";



