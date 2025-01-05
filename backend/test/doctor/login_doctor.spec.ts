import request from "supertest";
import { app } from "../../src/index";
import { prismaMock } from "../prismaMock";
import { mockSetDoctorData, testToken } from "./mockData/mockLoginDoctorData";

const { id, name, email, password } = mockSetDoctorData;
const mockSendDoctorData = { id, name, email, password }
describe("ログインしている医者データ取得テスト", () => {
    beforeAll(() => {
        prismaMock.doctors.findFirst.mockResolvedValue(mockSetDoctorData);
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })
    test("ログインしている医者データの取得", async () => {
        const response = await request(app).get("/doctor/login_doctor")
            .set("Authorization", `Bearer ${testToken}`)
            .send(mockSendDoctorData);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id,
            name,
            email,
            password
        });
    });

    test("ログインしている医者データの取得の失敗", async () => {
        const response = await request(app).get("/doctor/login_doctor")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })

})
