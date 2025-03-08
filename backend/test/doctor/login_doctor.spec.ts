import request from "supertest";
import { app } from "../../src/index";
import { prismaMock } from "../prismaMock";
import { mockSetDoctorData, testToken } from "./mockData/mockLoginDoctorData";
import { doctorCookieName } from "../../../common/util/CookieName";
const { id, name, email, password } = mockSetDoctorData[0];
const mockSendDoctorData = { id, name, email, password }

describe("ログインしている医者データ取得テスト", () => {

    afterEach(async () => {
        jest.clearAllMocks();
    })
    test("ログインしている医者データの取得", async () => {
        prismaMock.doctors.findFirst.mockResolvedValueOnce(mockSetDoctorData[0]);
        const response = await request(app).get("/doctor/login_doctor")
            .set("Cookie", `${doctorCookieName}=${testToken}`)
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject(mockSendDoctorData)
    });

    test("ログインしている医者データの取得の失敗", async () => {
        const response = await request(app).get("/doctor/login_doctor")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })
    test("ログインしている医者データの取得の失敗", async () => {
        const response = await request(app).get("/doctor/login_doctor")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })

    test("ログインしている医者データの取得の失敗 : データがない場合", async () => {
        const response = await request(app).get("/doctor/login_doctor")
            .set("Authorization", `Bearer ${testToken}`)
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("指定された医師が見つかりません。");
    })
})
