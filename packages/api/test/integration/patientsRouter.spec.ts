import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth/password";
import { derivePatientInitialPassword } from "../../src/domain/patientPassword.js";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertDoctor, insertPatient, NONEXISTENT_ID } from "../support/testRecords.js";

type InsertedPatient = Awaited<ReturnType<typeof insertPatient>>;

const newPatientInput = {
    name: "患者 太郎",
    email: "new-patient@example.com",
    tel: "080-1111-2222",
    sex: "man",
    address: "大阪府",
    birth: new Date("1985-05-05T00:00:00.000Z"),
};

const firstPageSortedById = { page: 1, pageSize: 10, sortBy: "id", sortOrder: "asc" } as const;

// 名前だけを変えた患者を順に登録する。メールアドレスは一意制約があるため連番にする。
const insertPatientsNamed = async (names: readonly string[]): Promise<InsertedPatient[]> => {
    const insertedPatients: InsertedPatient[] = [];
    for (const [index, name] of names.entries()) {
        insertedPatients.push(await insertPatient({ name, email: `patient-${index}@example.com` }));
    }
    return insertedPatients;
};

describe("doctor.patients.page", () => {
    test("一覧に表示する列だけを返し、連絡先・生年月日・パスワードを含まない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.patients.page.query(firstPageSortedById)).resolves.toEqual({
            items: [
                { id: patient.id, name: patient.name, sex: patient.sex, address: patient.address },
            ],
            totalCount: 1,
        });
    });

    test("指定したページの行と、ページングする前の全件数を返す", async () => {
        const patients = await insertPatientsNamed(
            Array.from({ length: 12 }, (_, index) => `患者 ${index + 1}`)
        );
        const client = await createDoctorClient(await insertDoctor());

        const secondPage = await client.doctor.patients.page.query({ ...firstPageSortedById, page: 2 });
        const outOfRangePage = await client.doctor.patients.page.query({ ...firstPageSortedById, page: 3 });

        expect(secondPage.items.map((item) => item.id)).toEqual(
            patients.slice(10).map((patient) => patient.id)
        );
        expect(secondPage.totalCount).toBe(12);
        expect(outOfRangePage).toEqual({ items: [], totalCount: 12 });
    });

    test("指定した列で並べ、同じ値の行は昇順・降順どちらでも id の昇順に並べる", async () => {
        const [firstSuzuki, sato, secondSuzuki] = await insertPatientsNamed(["鈴木", "佐藤", "鈴木"]);
        const client = await createDoctorClient(await insertDoctor());
        const sortedIds = async (sortOrder: "asc" | "desc") =>
            (
                await client.doctor.patients.page.query({ ...firstPageSortedById, sortBy: "name", sortOrder })
            ).items.map((item) => item.id);

        // 「佐」（U+4F50）は「鈴」（U+9234）より前に並ぶ。
        await expect(sortedIds("asc")).resolves.toEqual([sato.id, firstSuzuki.id, secondSuzuki.id]);
        await expect(sortedIds("desc")).resolves.toEqual([firstSuzuki.id, secondSuzuki.id, sato.id]);
    });

    test.each([
        ["許可していない列での並べ替え", { sortBy: "email" }],
        ["選択肢に無い 1 ページの件数", { pageSize: 1000 }],
        ["1 未満のページ", { page: 0 }],
    ])("%sは BAD_REQUEST になる", async (_, invalidInput) => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            // 不正な値を API に届けるため、型の検査を外して渡す。
            client.doctor.patients.page.query({ ...firstPageSortedById, ...invalidInput } as never)
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    });
});

describe("doctor.patients.byId", () => {
    test("存在しない患者は NOT_FOUND になる", async () => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.byId.query({ patientId: NONEXISTENT_ID })
        ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    });
});

describe("doctor.patients.create", () => {
    test("生年月日から導出した初期パスワードをハッシュ化して保存し、レスポンスにはパスワードを含まない", async () => {
        const client = await createDoctorClient(await insertDoctor());

        const createdPatient = await client.doctor.patients.create.mutate(newPatientInput);

        expect(createdPatient).toEqual({ id: createdPatient.id, ...newPatientInput });
        const storedPatient = await prisma.patients.findUniqueOrThrow({
            where: { id: createdPatient.id },
        });
        await expect(
            verifyPassword(storedPatient.password, derivePatientInitialPassword(newPatientInput.birth))
        ).resolves.toBe(true);
    });

    test("登録済みのメールアドレスでは BAD_REQUEST になり、患者は増えない", async () => {
        const existingPatient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.create.mutate({ ...newPatientInput, email: existingPatient.email })
        ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST" },
            message: "データの登録に失敗しました。",
        });
        await expect(prisma.patients.count()).resolves.toBe(1);
    });
});

describe("doctor.patients.update", () => {
    test("入力した内容で更新される", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());
        const updatedPatientInput = { ...newPatientInput, id: patient.id };

        await client.doctor.patients.update.mutate(updatedPatientInput);

        await expect(
            client.doctor.patients.byId.query({ patientId: patient.id })
        ).resolves.toEqual(updatedPatientInput);
    });

    test("性別に選択肢に無い値を渡すと BAD_REQUEST になり、患者は変わらない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.update.mutate({ ...newPatientInput, id: patient.id, sex: "unknown" })
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });

        await expect(
            prisma.patients.findUniqueOrThrow({ where: { id: patient.id } })
        ).resolves.toEqual(patient);
    });
});
