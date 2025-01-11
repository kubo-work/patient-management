import request from "supertest";
import { app } from "../../src/index";
import { prismaMock } from "../prismaMock";
import { mockSetDoctorData, testToken } from "./mockData/mockLoginDoctorData";
const { id, name, email, password, created_at, updated_at } = mockSetDoctorData[0];
const mockSendDoctorData = { id, name, email, password }

describe("ログインしている医者データ取得テスト", () => {

    afterAll(() => {
        jest.clearAllMocks();
    })

    test("ログインしている医者データの取得", async () => {
        prismaMock.doctors.findFirst.mockResolvedValue(mockSetDoctorData[0]);
        const response = await request(app).get("/doctor/login_doctor")
            .set("Authorization", `Bearer ${testToken}`)
        expect(response.status).toBe(200);
        expect(response.body).toStrictEqual(mockSendDoctorData)
    });

    test("ログインしている医者データの取得の失敗", async () => {
        const response = await request(app).get("/doctor/login_doctor")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })

    test("ログインしている医者データの取得の失敗 : データがない場合", async () => {
        jest.spyOn(prismaMock.doctors, "findFirst").mockImplementationOnce(() => {
            throw new Error("Test Error");
        });
        const response = await request(app).get("/doctor/login_doctor")
            .set("Authorization", `Bearer ${testToken}`)
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("データの取得に失敗しました。");
    })

})
