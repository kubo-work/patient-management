import { describe, test, expect, afterEach, vi, type Mock } from "vitest";
import { app } from "../../src/app.js";
import { prismaMock } from "../prismaMock.js";
import { mockSetDoctorData, testToken } from "./mockData/mockLoginDoctorData.js";
import { faker } from "@faker-js/faker";
import { Prisma } from "@repo/db";
import { doctorCookieName } from "@repo/schema";

const mockSendDoctorData = mockSetDoctorData.map((data) => {
    const { id, name, email, password } = data;
    return { id, name, email, password }
})

describe("全医者データ取得", () => {
    afterEach(async () => {
        vi.clearAllMocks();
    })

    test("医者データの取得", async () => {
        prismaMock.doctors.findMany.mockResolvedValue(mockSetDoctorData);
        const response = await app.request("/doctor/doctors", {
            headers: { cookie: `${doctorCookieName}=${testToken}` },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(mockSendDoctorData)
    })

    test("医者データの取得の失敗 : ログインしていない時", async () => {
        const response = await app.request("/doctor/doctors");
        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe("ログインしてください。");
    })

    test("医者データの取得の失敗 : データがない時", async () => {
        const response = await app.request("/doctor/doctors", {
            headers: { cookie: `${doctorCookieName}=${testToken}` },
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("データの取得に失敗しました。");
    })
});

describe("指定の医者データ取得", () => {

    afterEach(async () => {
        vi.clearAllMocks();
    })

    test("指定の医者データの取得 : 成功", async () => {
        prismaMock.doctors.findFirst.mockResolvedValueOnce(mockSetDoctorData[0])
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            headers: { cookie: `${doctorCookieName}=${testToken}` },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(mockSendDoctorData[0])
    })

    test("医者データの取得の失敗 : ログインしていない時", async () => {
        const response = await app.request("/doctor/doctors");
        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe("ログインしてください。");
    })

    test("医者データの取得の失敗 : データがない時", async () => {
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            headers: { cookie: `${doctorCookieName}=${testToken}` },
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe("指定された医師が見つかりません。");
    })
});

describe("医者データ更新", () => {
    afterEach(async () => {
        vi.clearAllMocks();
    })

    test("医者データ更新 : 成功", async () => {
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            method: "PUT",
            headers: {
                cookie: `${doctorCookieName}=${testToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(200);
    })

    test("医者データ更新 : 失敗（必須項目が欠けている）", async () => {
        const mockPutDoctorData = {
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            method: "PUT",
            headers: {
                cookie: `${doctorCookieName}=${testToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("入力データが不正です。");
    })

    test("医者データ更新 : 失敗（指定された医者がみつかrない）", async () => {
        (prismaMock.doctors.update as unknown as Mock).mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("Record not found", {
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
        const response = await app.request(`/doctor/doctors/${id}`, {
            method: "PUT",
            headers: {
                cookie: `${doctorCookieName}=${testToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe("指定された医師が見つかりません。");
    })

    test("医者データ更新 : 失敗（ログインしていない）", async () => {
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(401);
        expect((await response.json()).error).toBe("ログインしてください。");
    })
})

describe("医者データ新規作成", () => {
    afterEach(async () => {
        vi.clearAllMocks();
    })

    test("医者データ新規作成 : 成功", async () => {
        const mockPutDoctorData = {
            name: faker.person.fullName(),
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await app.request(`/doctor/doctors`, {
            method: "POST",
            headers: {
                cookie: `${doctorCookieName}=${testToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(200);
    })

    test("医者データ新規作成 : 失敗（必須項目が欠けている）", async () => {
        const mockPutDoctorData = {
            email: faker.internet.email(),
            password: faker.internet.password()
        }
        const response = await app.request(`/doctor/doctors/${mockSetDoctorData[0].id}`, {
            method: "PUT",
            headers: {
                cookie: `${doctorCookieName}=${testToken}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(mockPutDoctorData),
        });
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("入力データが不正です。");
    })
})
