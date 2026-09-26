import pg from "pg";
import { hashPassword } from "@repo/auth/password";
import { DATABASE_URL } from "./testEnvironment.ts";

// 各テストの前に DB を空にし、同じ初期データを入れ直す。
// テストの順序や、前のテストで作ったデータに結果が左右されないようにするため。
// DB は scripts/startTestServer.ts が TCP で公開している PGlite で、アプリと同じものを見る。

export const SEEDED_DOCTOR = {
    id: 1,
    name: "医師 一郎",
    email: "doctor@example.com",
    password: "doctor-password",
};

// argon2 のハッシュ化は毎回同じ入力なので、ワーカーごとに 1 回だけ計算する。
const seededDoctorPasswordHash = hashPassword(SEEDED_DOCTOR.password);

export const resetDatabase = async (): Promise<void> => {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
        const { rows } = await client.query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
        );
        const tableNames = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
        await client.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE`);
        await client.query(
            "INSERT INTO doctors (name, email, password) VALUES ($1, $2, $3)",
            [SEEDED_DOCTOR.name, SEEDED_DOCTOR.email, await seededDoctorPasswordHash]
        );
    } finally {
        await client.end();
    }
};
