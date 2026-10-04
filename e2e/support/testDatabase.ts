import pg from "pg";
import { hashPassword } from "@repo/auth/password";
import { buildTruncateAllTablesSql, USER_TABLES_QUERY } from "@repo/db/testing";
import { DATABASE_URL } from "./testEnvironment.ts";

// 各テストの前に DB を空にし、同じ初期データを入れ直す。
// テストの順序や、前のテストで作ったデータに結果が左右されないようにするため。
// DB は scripts/startTestServer.ts が TCP で公開している PGlite で、アプリと同じものを見る。

export const SEEDED_DOCTOR = {
    name: "医師 一郎",
    email: "doctor@example.com",
    password: "doctor-password",
};

export const SEEDED_PATIENT = {
    name: "患者 花子",
    email: "patient@example.com",
    tel: "090-0000-0000",
    address: "東京都",
    birth: "1990-01-01T00:00:00.000Z",
};

// 患者のログインは無く、パスワードを検証するテストも無いため、ハッシュ化していない値をそのまま入れる。
const UNUSED_PATIENT_PASSWORD = "unused-patient-password";

// 診察記録のフォームは、親カテゴリごとに子カテゴリを選ぶ欄を出す。
export const SEEDED_CATEGORIES = {
    PARENT: "保険適用施術",
    CHILDREN: ["電気療法", "手技療法"],
} as const;

type PatientRecord = { name: string; email: string; tel: string; address: string; birth: string };
type DoctorRecord = { name: string; email: string };

const insertPatientWith = async (client: pg.Client, patient: PatientRecord): Promise<number> => {
    const {
        rows: [insertedPatient],
    } = await client.query<{ id: number }>(
        "INSERT INTO patients (name, email, password, tel, address, birth) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [patient.name, patient.email, UNUSED_PATIENT_PASSWORD, patient.tel, patient.address, patient.birth]
    );
    if (!insertedPatient) {
        throw new Error(`患者「${patient.name}」の登録結果が返りませんでした。`);
    }
    return insertedPatient.id;
};

const withClient = async <Result>(run: (client: pg.Client) => Promise<Result>): Promise<Result> => {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
        return await run(client);
    } finally {
        await client.end();
    }
};

// 初期データに加えて、テストごとの前提となる患者を登録する。登録した患者の id を返す。
export const insertPatient = (patient: PatientRecord): Promise<number> =>
    withClient((client) => insertPatientWith(client, patient));

// ログインに使わない医師のパスワード。照合されないため、ハッシュ化していない値をそのまま入れる。
const UNUSED_DOCTOR_PASSWORD = "unused-doctor-password";

// 初期データの医師に加えて、担当者として選ぶだけの医師を登録する。
export const insertDoctor = (doctor: DoctorRecord): Promise<void> =>
    withClient(async (client) => {
        await client.query("INSERT INTO doctors (name, email, password) VALUES ($1, $2, $3)", [
            doctor.name,
            doctor.email,
            UNUSED_DOCTOR_PASSWORD,
        ]);
    });

export const findPatientIdByEmail = (email: string): Promise<number> =>
    withClient(async (client) => {
        const {
            rows: [foundPatient],
        } = await client.query<{ id: number }>("SELECT id FROM patients WHERE email = $1", [email]);
        if (!foundPatient) {
            throw new Error(`メールアドレス「${email}」の患者が見つかりませんでした。`);
        }
        return foundPatient.id;
    });

const insertCategory = async (
    client: pg.Client,
    treatment: string,
    parentCategoryId: number | null
): Promise<number> => {
    const {
        rows: [insertedCategory],
    } = await client.query<{ id: number }>(
        "INSERT INTO categories (treatment, parent_id) VALUES ($1, $2) RETURNING id",
        [treatment, parentCategoryId]
    );
    if (!insertedCategory) {
        throw new Error(`カテゴリ「${treatment}」の登録結果が返りませんでした。`);
    }
    return insertedCategory.id;
};

const insertCategories = async (client: pg.Client): Promise<void> => {
    const parentCategoryId = await insertCategory(client, SEEDED_CATEGORIES.PARENT, null);
    for (const childTreatment of SEEDED_CATEGORIES.CHILDREN) {
        await insertCategory(client, childTreatment, parentCategoryId);
    }
};

export const resetDatabase = (): Promise<void> =>
    withClient(async (client) => {
        const { rows } = await client.query<{ tablename: string }>(USER_TABLES_QUERY);
        await client.query(buildTruncateAllTablesSql(rows.map((row) => row.tablename)));
        // argon2 のハッシュ化は 1 回約 16ms のため、結果を保持する状態を持たずに毎回計算する。
        await client.query("INSERT INTO doctors (name, email, password) VALUES ($1, $2, $3)", [
            SEEDED_DOCTOR.name,
            SEEDED_DOCTOR.email,
            await hashPassword(SEEDED_DOCTOR.password),
        ]);
        await insertPatientWith(client, SEEDED_PATIENT);
        await insertCategories(client);
    });
