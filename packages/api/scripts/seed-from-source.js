/**
 * 別の Postgres から全件データを取り込むスクリプト
 *
 * 移行元を SOURCE_DATABASE_URL、移行先を DATABASE_URL で指定する。
 * doctors テーブルが空 かつ SOURCE_DATABASE_URL が設定されている場合のみ取り込む（冪等）。
 *
 * 想定する用途:
 *   - Supabase から Neon への移行
 *   - AWS 復帰時に Neon から RDS へ初期データを投入（ECS タスク起動時に自動実行）
 *   - ローカル DB を作り直したときに Neon から復元
 *
 * 手動実行:
 *   cd packages/api
 *   SOURCE_DATABASE_URL="postgres://..." DATABASE_URL="postgres://..." node scripts/seed-from-source.js
 *
 * 事前条件:
 *   移行先には prisma migrate deploy でスキーマが作成済みであること。
 */

import pg from "pg";
const { Pool } = pg;

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL;

if (!sourceDatabaseUrl) {
  console.log("ℹ️  SOURCE_DATABASE_URL 未設定のため取り込みをスキップ");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL が設定されていません");
  process.exit(1);
}

/**
 * 接続先に応じて SSL の要否を切り替える。
 * ローカルの Postgres（compose.yaml）は SSL 非対応なので無効にする必要がある。
 *
 * リモートでは rejectUnauthorized: false としている。RDS / Supabase のサーバ証明書を
 * 発行する CA が Node の既定トラストストアに含まれておらず、検証を有効にすると接続でき
 * ないため。移行時にだけ短時間張る管理用接続なので、この範囲では許容する。
 */
function createPool(connectionString) {
  const hostname = new URL(connectionString).hostname;
  const isLocalDatabase = LOCAL_HOSTNAMES.includes(hostname);

  return new Pool({
    connectionString,
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });
}

const sourcePool = createPool(sourceDatabaseUrl);
const targetPool = createPool(process.env.DATABASE_URL);

async function run() {
  console.log("🔌 接続確認中...");
  await sourcePool.query("SELECT 1");
  await targetPool.query("SELECT 1");
  console.log("✅ 両 DB に接続できました");

  // doctors が空でなければ取り込み済みとみなしてスキップ
  const { rows: existing } = await targetPool.query("SELECT COUNT(*) FROM doctors");
  if (Number(existing[0].count) > 0) {
    console.log("ℹ️  移行先に既にデータがあるため取り込みをスキップ");
    return;
  }

  console.log("🚀 取り込み開始...\n");

  // ─── 既存データをクリア（念のため） ───────────────────────────────
  await targetPool.query(
    "TRUNCATE medical_categories, medical_records, categories, patients, doctors RESTART IDENTITY CASCADE"
  );

  // ─── doctors ────────────────────────────────────────────────────
  await copyTable("doctors", ["id", "name", "password", "email", "created_at", "updated_at"]);

  // ─── patients ───────────────────────────────────────────────────
  await copyTable("patients", [
    "id", "name", "sex", "tel", "address", "email", "password", "birth", "created_at", "updated_at",
  ]);

  // ─── categories（自己参照 → 2パスで挿入） ────────────────────────
  console.log("📋 categories を取り込み中...");
  const categoryRows = await sourcePool.query('SELECT * FROM "categories" ORDER BY id');
  for (const row of categoryRows.rows) {
    await targetPool.query(
      `INSERT INTO "categories" (id, treatment, created_at, updated_at, parent_id)
       VALUES ($1, $2, $3, $4, NULL) ON CONFLICT (id) DO NOTHING`,
      [row.id, row.treatment, row.created_at, row.updated_at]
    );
  }
  for (const row of categoryRows.rows.filter((category) => category.parent_id != null)) {
    await targetPool.query("UPDATE categories SET parent_id = $1 WHERE id = $2", [row.parent_id, row.id]);
  }
  await resetSequence("categories");
  console.log(`   ✅ categories: ${categoryRows.rows.length} 件\n`);

  // ─── medical_records ────────────────────────────────────────────
  await copyTable("medical_records", [
    "id", "patient_id", "doctor_id", "medical_memo", "doctor_memo",
    "examination_at", "created_at", "updated_at", '"delFlag"',
  ]);

  // ─── medical_categories ─────────────────────────────────────────
  await copyTable("medical_categories", [
    "id", "medical_record_id", "category_id", "created_at", "updated_at", '"delFlag"',
  ]);

  console.log("🎉 取り込み完了！");
}

async function copyTable(tableName, columns) {
  console.log(`📋 ${tableName} を取り込み中...`);
  const columnsForSelect = columns.join(", ");
  const sourceResult = await sourcePool.query(`SELECT ${columnsForSelect} FROM "${tableName}" ORDER BY id`);
  if (sourceResult.rows.length === 0) {
    console.log(`   ⚠️  ${tableName}: データなし\n`);
    return;
  }
  const columnNames = columns.map((column) => column.replace(/"/g, ""));
  const columnList = columns.join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  for (const row of sourceResult.rows) {
    await targetPool.query(
      `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      columnNames.map((columnName) => row[columnName])
    );
  }
  await resetSequence(tableName);
  console.log(`   ✅ ${tableName}: ${sourceResult.rows.length} 件\n`);
}

async function resetSequence(tableName) {
  await targetPool.query(
    `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 0))`,
    [tableName]
  );
}

run()
  .catch((error) => { console.error("❌ エラー:", error.message); process.exit(1); })
  .finally(async () => { await sourcePool.end(); await targetPool.end(); });
