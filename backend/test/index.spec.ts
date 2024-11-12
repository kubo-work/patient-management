import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../src/index";

type TestLoginPostData = {
    email: string;
    password: string
}

const testLoginPostData: TestLoginPostData = {
    email: process.env.LOGIN_SUCCESS_EMAIL,
    password: process.env.LOGIN_SUCCESS_PASSWORD
}

const prisma = new PrismaClient();

describe("API テスト", () => {
    let server: any;

    beforeAll(() => {
        server = app.listen(8080)
    });

    afterAll(async () => {
        await prisma.$disconnect();
        await server.close();
    });

    test("Loginの成功", async () => {
        const response = await request(app).post("/doctor/login").send(testLoginPostData);
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("ログインに成功しました。");
    });

    test("Loginの失敗 メールアドレスがない場合", async () => {
        const dummyTestLoginData: TestLoginPostData = { email: "", password: "" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("メールアドレスが入力されていません。");
    })

    test("Loginの失敗 パスワードがない場合", async () => {
        const dummyTestLoginData: TestLoginPostData = { email: "dummy@example.com", password: "" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("パスワードが入力されていません。");
    })

    test("Loginの失敗 メールアドレスとパスワードが正しくない場合", async () => {
        const dummyTestLoginData: TestLoginPostData = { email: "dummy@example.com", password: "aaa" }
        const response = await request(app).post("/doctor/login").send(dummyTestLoginData);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("無効なメールアドレスまたはパスワードです。");
    })
})
