import { beforeEach } from "vitest";
import { startTestDatabase } from "./testDatabaseServer.js";

// 結合テスト（api-integration project）の setupFiles。テストファイルごとに評価される。
// DB 自体はワーカーごとに 1 つで、最初のテストファイルの startTestDatabase() で立ち上がる。
// setupFiles はテストファイルより先に評価されるため、テストファイルが @repo/db を
// 読み込む時点で DATABASE_URL はこの DB を向いている。
//
// 各テストを空の DB から始めることで、同じ DB を使う別のテストファイルとも干渉しない。
// Issue #288 は「テストごとにトランザクションでロールバック」を挙げていたが、
// repository が @repo/db のシングルトンを直接使う構造ではテスト側から
// トランザクションを差し込めないため、TRUNCATE で初期化する。
const { truncateAllTables } = await startTestDatabase();

beforeEach(truncateAllTables);
