import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth/password";
import {
    createDoctorClient,
    createTestClient,
    LOGIN_SUCCEEDED_RESPONSE,
} from "../support/trpcTestClient.js";
import { insertDoctor, NONEXISTENT_ID } from "../support/testRecords.js";

describe("doctor.doctors.list", () => {
    test("医師を id 順に返し、パスワードを含まない", async () => {
        const firstDoctor = await insertDoctor({ name: "医師 一郎", email: "first@example.com" });
        const secondDoctor = await insertDoctor({ name: "医師 二郎", email: "second@example.com" });
        const client = await createDoctorClient(firstDoctor);

        await expect(client.doctor.doctors.list.query()).resolves.toEqual([
            { id: firstDoctor.id, name: "医師 一郎", email: "first@example.com" },
            { id: secondDoctor.id, name: "医師 二郎", email: "second@example.com" },
        ]);
    });
});

describe("doctor.doctors.page", () => {
    test("指定した列で並べた 1 ページ分と全件数を返し、パスワードを含まない", async () => {
        const firstDoctor = await insertDoctor({ name: "医師 一郎", email: "a@example.com" });
        const secondDoctor = await insertDoctor({ name: "医師 二郎", email: "b@example.com" });
        const client = await createDoctorClient(firstDoctor);

        await expect(
            client.doctor.doctors.page.query({ page: 1, pageSize: 10, sortBy: "email", sortOrder: "desc" })
        ).resolves.toEqual({
            items: [
                { id: secondDoctor.id, name: "医師 二郎", email: "b@example.com" },
                { id: firstDoctor.id, name: "医師 一郎", email: "a@example.com" },
            ],
            totalCount: 2,
        });
    });
});

describe("doctor.doctors.byId", () => {
    test("存在しない医師は NOT_FOUND になる", async () => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.doctors.byId.query({ doctorId: NONEXISTENT_ID })
        ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    });
});

describe("doctor.doctors.create", () => {
    test("パスワードをハッシュ化して保存し、レスポンスにはパスワードを含まない", async () => {
        const client = await createDoctorClient(await insertDoctor());

        const createdDoctor = await client.doctor.doctors.create.mutate({
            name: "医師 三郎",
            email: "new@example.com",
            password: "new-doctor-password",
        });

        expect(createdDoctor).toEqual({
            id: createdDoctor.id,
            name: "医師 三郎",
            email: "new@example.com",
        });
        const storedDoctor = await prisma.doctors.findUniqueOrThrow({
            where: { id: createdDoctor.id },
        });
        expect(storedDoctor.password).not.toBe("new-doctor-password");
        await expect(verifyPassword(storedDoctor.password, "new-doctor-password")).resolves.toBe(
            true
        );
    });

    test("登録済みのメールアドレスでは BAD_REQUEST になり、医師は増えない", async () => {
        const client = await createDoctorClient(await insertDoctor({ email: "taken@example.com" }));

        await expect(
            client.doctor.doctors.create.mutate({
                name: "医師 三郎",
                email: "taken@example.com",
                password: "new-doctor-password",
            })
        ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST" },
            message: "データの保存に失敗しました。",
        });
        await expect(prisma.doctors.count()).resolves.toBe(1);
    });
});

describe("doctor.doctors.update", () => {
    test("存在しない医師の更新は NOT_FOUND になる", async () => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.doctors.update.mutate({
                doctorId: NONEXISTENT_ID,
                name: "医師 九郎",
                email: "nobody@example.com",
            })
        ).rejects.toMatchObject({
            data: { code: "NOT_FOUND" },
            message: "指定された医師が見つかりません。",
        });
    });

    test("パスワードを省略すると、名前とメールアドレスだけが変わり、元のパスワードでログインできる", async () => {
        const doctor = await insertDoctor({ plainPassword: "original-password" });
        const client = await createDoctorClient(doctor);

        await expect(
            client.doctor.doctors.update.mutate({
                doctorId: doctor.id,
                name: "医師 一郎（改名）",
                email: "renamed@example.com",
            })
        ).resolves.toEqual({ id: doctor.id, name: "医師 一郎（改名）", email: "renamed@example.com" });

        await expect(
            createTestClient().doctor.login.mutate({
                email: "renamed@example.com",
                password: "original-password",
            })
        ).resolves.toEqual(LOGIN_SUCCEEDED_RESPONSE);
    });

    test("パスワードを指定すると、新しいパスワードでだけログインできるようになる", async () => {
        const doctor = await insertDoctor({ plainPassword: "original-password" });
        const client = await createDoctorClient(doctor);

        await client.doctor.doctors.update.mutate({
            doctorId: doctor.id,
            name: doctor.name,
            email: doctor.email,
            password: "changed-password",
        });

        const anonymousClient = createTestClient();
        await expect(
            anonymousClient.doctor.login.mutate({ email: doctor.email, password: "changed-password" })
        ).resolves.toEqual(LOGIN_SUCCEEDED_RESPONSE);
        await expect(
            anonymousClient.doctor.login.mutate({ email: doctor.email, password: "original-password" })
        ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    });
});
