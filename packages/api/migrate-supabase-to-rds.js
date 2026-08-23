/**
 * Supabase → RDS 全件データ移行スクリプト
 *
 * コンテナ起動時に自動実行される。
 * doctors テーブルが空 かつ SUPABASE_URL が設定されている場合のみ移行する（冪等）。
 *
 * 手動実行:
 *   cd /app/backend
 *   SUPABASE_URL="postgres://..." node migrate-supabase-to-rds.js
 */

import pg from "pg";
const { Pool } = pg;

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  console.log("ℹ️  SUPABASE_URL 未設定のため移行をスキップ");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL が設定されていません");
  process.exit(1);
}

const src = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });
const dst = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log("🔌 接続確認中...");
  await src.query("SELECT 1");
  await dst.query("SELECT 1");
  console.log("✅ 両 DB に接続できました");

  // doctors が空でなければ移行済みとみなしてスキップ
  const { rows: existing } = await dst.query("SELECT COUNT(*) FROM doctors");
  if (Number(existing[0].count) > 0) {
    console.log("ℹ️  RDS に既にデータがあるため移行をスキップ");
    return;
  }

  console.log("🚀 移行開始...\n");

  // ─── 既存データをクリア（念のため） ───────────────────────────────
  await dst.query(
    "TRUNCATE medical_categories, medical_records, categories, patients, doctors RESTART IDENTITY CASCADE"
  );

  // ─── doctors ────────────────────────────────────────────────────
  await copyTable("doctors", ["id", "name", "password", "email", "created_at", "updated_at"]);

  // ─── patients ───────────────────────────────────────────────────
  await copyTable("patients", [
    "id", "name", "sex", "tel", "address", "email", "password", "birth", "created_at", "updated_at",
  ]);

  // ─── categories（自己参照 → 2パスで挿入） ────────────────────────
  console.log("📋 categories を移行中...");
  const cats = await src.query('SELECT * FROM "categories" ORDER BY id');
  for (const row of cats.rows) {
    await dst.query(
      `INSERT INTO "categories" (id, treatment, created_at, updated_at, parent_id)
       VALUES ($1, $2, $3, $4, NULL) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.treatment, row.created_at, row.updated_at]
    );
  }
  for (const row of cats.rows.filter((r) => r.parent_id != null)) {
    await dst.query("UPDATE categories SET parent_id = $1 WHERE id = $2", [row.parent_id, row.id]);
  }
  await resetSeq("categories");
  console.log(`   ✅ categories: ${cats.rows.length} 件\n`);

  // ─── medical_records ────────────────────────────────────────────
  await copyTable("medical_records", [
    "id", "patient_id", "doctor_id", "medical_memo", "doctor_memo",
    "examination_at", "created_at", "updated_at", '"delFlag"',
  ]);

  // ─── medical_categories ─────────────────────────────────────────
  await copyTable("medical_categories", [
    "id", "medical_record_id", "category_id", "created_at", "updated_at", '"delFlag"',
  ]);

  console.log("🎉 移行完了！");
}

async function copyTable(tableName, columns) {
  console.log(`📋 ${tableName} を移行中...`);
  const colsForSelect = columns.join(", ");
  const res = await src.query(`SELECT ${colsForSelect} FROM "${tableName}" ORDER BY id`);
  if (res.rows.length === 0) {
    console.log(`   ⚠️  ${tableName}: データなし\n`);
    return;
  }
  const plainCols = columns.map((c) => c.replace(/"/g, ""));
  const colList = columns.join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  for (const row of res.rows) {
    await dst.query(
      `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      plainCols.map((c) => row[c])
    );
  }
  await resetSeq(tableName);
  console.log(`   ✅ ${tableName}: ${res.rows.length} 件\n`);
}

async function resetSeq(tableName) {
  await dst.query(
    `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 0))`,
    [tableName]
  );
}

run()
  .catch((e) => { console.error("❌ エラー:", e.message); process.exit(1); })
  .finally(async () => { await src.end(); await dst.end(); });
