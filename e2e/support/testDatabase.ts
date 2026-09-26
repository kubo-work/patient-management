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

// 診察記録のフォームは、親カテゴリごとに子カテゴリを選ぶ欄を出す。
export const SEEDED_CATEGORIES = {
    PARENT: "内科",
    CHILDREN: ["風邪", "頭痛"],
} as const;

const insertCategories = async (client: pg.Client): Promise<void> => {
    const { rows } = await client.query<{ id: number }>(
        "INSERT INTO categories (treatment) VALUES ($1) RETURNING id",
        [SEEDED_CATEGORIES.PARENT]
    );
    const [parentCategory] = rows;
    for (const childTreatment of SEEDED_CATEGORIES.CHILDREN) {
        await client.query("INSERT INTO categories (treatment, parent_id) VALUES ($1, $2)", [
            childTreatment,
            parentCategory.id,
        ]);
    }
};

export const resetDatabase = async (): Promise<void> => {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
        const { rows } = await client.query<{ tablename: string }>(USER_TABLES_QUERY);
        await client.query(buildTruncateAllTablesSql(rows.map((row) => row.tablename)));
        // argon2 のハッシュ化は 1 回約 16ms のため、結果を保持する状態を持たずに毎回計算する。
        await client.query("INSERT INTO doctors (name, email, password) VALUES ($1, $2, $3)", [
            SEEDED_DOCTOR.name,
            SEEDED_DOCTOR.email,
            await hashPassword(SEEDED_DOCTOR.password),
        ]);
        // 患者のログインは無く、パスワードを検証するテストも無いため、ハッシュ化しない。
        await client.query(
            "INSERT INTO patients (name, email, password, tel, address, birth) VALUES ($1, $2, $3, $4, $5, $6)",
            [
                SEEDED_PATIENT.name,
                SEEDED_PATIENT.email,
                "unused-patient-password",
                SEEDED_PATIENT.tel,
                SEEDED_PATIENT.address,
                SEEDED_PATIENT.birth,
            ]
        );
        await insertCategories(client);
    } finally {
        await client.end();
    }
};
