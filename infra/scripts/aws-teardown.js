import { execSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE = "patient";
const ROOT_PROFILE = "patient-admin";
const REGION = "ap-northeast-1";
const STATE_BUCKET = "terraform-state-patient-management-dev-kubo";
const USER_NAME = "aws-patient-management";
const ADMIN_POLICY_ARN = "arn:aws:iam::aws:policy/AdministratorAccess";
const INFRA_DIR = resolve(__dirname, ".."); // scripts/の一つ上 = infra/

function run(cmd, options = {}) {
    return execSync(cmd, { stdio: "inherit", ...options });
}

try {
    // 1. AdministratorAccess をアタッチ（adminプロファイルで実行）
    console.log("🔑 Attaching AdministratorAccess...");
    run(
        `aws iam attach-user-policy \
      --user-name ${USER_NAME} \
      --policy-arn ${ADMIN_POLICY_ARN} \
      --profile ${ROOT_PROFILE}`
    );
    console.log("✅ AdministratorAccess attached");

    // 権限反映待ち
    console.log("⏳ Waiting for permissions to propagate...");
    await new Promise((r) => setTimeout(r, 5000));

    // 2. バケットの中身を削除
    console.log("\n🗑️  Emptying state bucket...");
    try {
        run(`aws s3 rm s3://${STATE_BUCKET} --recursive --profile ${PROFILE}`, { cwd: INFRA_DIR });
        console.log("✅ Bucket emptied");
    } catch {
        console.log("✅ Bucket already empty or does not exist");
    }

    // 3. バケット自体を削除
    console.log("\n🪣 Deleting state bucket...");
    try {
        run(
            `aws s3api delete-bucket \
        --bucket ${STATE_BUCKET} \
        --region ${REGION} \
        --profile ${ROOT_PROFILE}`,
            { cwd: INFRA_DIR }
        );
        console.log("✅ State bucket deleted");
    } catch {
        console.log("✅ Bucket does not exist");
    }


    // 4. AdministratorAccess を即外す（adminプロファイルで実行）
    console.log("\n🔑 Detaching AdministratorAccess...");
    run(
        `aws iam detach-user-policy \
      --user-name ${USER_NAME} \
      --policy-arn ${ADMIN_POLICY_ARN} \
      --profile ${ROOT_PROFILE}`
    );
    console.log("✅ AdministratorAccess detached");

    console.log("\n🎉 Teardown complete!");
    console.log("📝 stateバケットが削除されました");
    console.log("   再度使う場合は npm run setup を実行してください");

} catch (err) {
    console.error("❌ Error:", err.message);
    console.log("\n🔑 Detaching AdministratorAccess for safety...");
    try {
        execSync(
            `aws iam detach-user-policy \
        --user-name ${USER_NAME} \
        --policy-arn ${ADMIN_POLICY_ARN} \
        --profile ${ROOT_PROFILE}`,
            {
                cwd: INFRA_DIR,
                stdio: "inherit",
            }
        );
        console.log("✅ AdministratorAccess detached");
    } catch {
        console.log("⚠️ Could not detach AdministratorAccess. Please detach manually.");
    }
    process.exit(1);
}
