import request from "supertest";
import { app } from "../../src/index";
import { prismaMock } from "../prismaMock";
import { mockSetDoctorData, testToken } from "./mockData/mockLoginDoctorData";
import { faker } from "@faker-js/faker/.";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { doctorCookieName } from "../../../common/util/CookieName";

const mockSendDoctorData = mockSetDoctorData.map((data) => {
    const { id, name, email, password } = data;
    return { id, name, email, password }
})

describe("全医者データ取得", () => {
    afterEach(async () => {
        jest.clearAllMocks();
    })

    test("医者データの取得", async () => {
        prismaMock.doctors.findMany.mockResolvedValue(mockSetDoctorData);
        const response = await request(app).get("/doctor/doctors")
            .set("Cookie", `${doctorCookieName}=${testToken}`)
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockSendDoctorData)
    })

    test("医者データの取得の失敗 : ログインしていない時", async () => {
        const response = await request(app).get("/doctor/doctors")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })

    test("医者データの取得の失敗 : データがない時", async () => {
        const response = await request(app).get("/doctor/doctors")
            .set("Cookie", `${doctorCookieName}=${testToken}`)
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("データの取得に失敗しました。");
    })
});

describe("指定の医者データ取得", () => {

    afterEach(async () => {
        jest.clearAllMocks();
    })

    test("指定の医者データの取得 : 成功", async () => {
        prismaMock.doctors.findFirst.mockResolvedValueOnce(mockSetDoctorData[0])
        const response = await request(app).get(`/doctor/doctors/${mockSetDoctorData[0].id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockSendDoctorData[0])
    })

    test("医者データの取得の失敗 : ログインしていない時", async () => {
        const response = await request(app).get("/doctor/doctors")
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("ログインしてください。");
    })

    test("医者データの取得の失敗 : データがない時", async () => {
        const response = await request(app).get(`/doctor/doctors/${mockSetDoctorData[0].id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("指定された医師が見つかりません。");
    })
});

describe("医者データ更新", () => {
    afterEach(async () => {
        jest.clearAllMocks();
    })

    test("医者データ更新 : 成功", async () => {
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await request(app).put(`/doctor/doctors/${mockSetDoctorData[0].id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
            .send(mockPutDoctorData);
        expect(response.status).toBe(200);
    })

    test("医者データ更新 : 失敗（必須項目が欠けている）", async () => {
        const mockPutDoctorData = {
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await request(app).put(`/doctor/doctors/${mockSetDoctorData[0].id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
            .send(mockPutDoctorData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("入力データが不正です。");
    })

    test("医者データ更新 : 失敗（指定された医者がみつかrない）", async () => {
        (prismaMock.doctors.update as jest.Mock).mockRejectedValue(
            new PrismaClientKnownRequestError("Record not found", {
                code: "P2025",
                clientVersion: Prisma.prismaVersion.client
            })
        );
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const id = faker.number.int({ min: 1000, max: 9999 })
        const response = await request(app).put(`/doctor/doctors/${id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
            .send(mockPutDoctorData);
        expect(response.status).toBe(404);
        expect(response.body.error).toBe("指定された医師が見つかりません。");
    })
})

describe("医者データ新規作成", () => {
    afterEach(async () => {
        jest.clearAllMocks();
    })

    test("医者データ新規作成 : 成功", async () => {
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await request(app).post(`/doctor/doctors`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
            .send(mockPutDoctorData);
        expect(response.status).toBe(200);
    })

    test("医者データ新規作成 : 失敗（必須項目が欠けている）", async () => {
        const mockPutDoctorData = {
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await request(app).put(`/doctor/doctors/${mockSetDoctorData[0].id}`)
            .set("Cookie", `${doctorCookieName}=${testToken}`)
            .send(mockPutDoctorData);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("入力データが不正です。");
    })
})
