import request from "supertest";
import { prismaMock } from "../prismaMock";
import { app } from "../../src/index";
import { mockSetDoctorData } from "./mockData/mockLoginDoctorData";

type mockLoginPostData = {
    email: string;
    password: string
}

const mockLoginPostData: mockLoginPostData = {
    email: mockSetDoctorData.email,
    password: mockSetDoctorData.password
}

describe("ログインのテスト", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    })

    test("ログインの成功", async () => {
        prismaMock.doctors.findFirst.mockResolvedValue(mockSetDoctorData);
        const response = await request(app).post("/doctor/login").send(mockLoginPostData);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("ログインに成功しました。");
    });

    test("ログインの失敗 メールアドレスがない場合", async () => {
        const dummyTestLoginData: mockLoginPostData = { email: "", password: "" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("メールアドレスが入力されていません。");
    })

    test("ログインの失敗 パスワードがない場合", async () => {
        const dummyTestLoginData: mockLoginPostData = { email: "dummy@example.com", password: "" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("パスワードが入力されていません。");
    })

    test("Loginの失敗 メールアドレスとパスワードが正しくない場合", async () => {
        prismaMock.doctors.findFirst.mockResolvedValue(null);
        const dummyTestLoginData: mockLoginPostData = { email: "dummy@example.com", password: "aaa" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("無効なメールアドレスまたはパスワードです。");
    })
})
