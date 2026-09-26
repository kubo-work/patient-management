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
    } finally {
        await client.end();
    }
};
