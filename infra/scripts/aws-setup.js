import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");

const PROFILE = "patient";
const ROOT_PROFILE = "patient-admin";
const REGION = "ap-northeast-1";
const STATE_BUCKET = "terraform-state-patient-management-dev-kubo";
const USER_NAME = "aws-patient-management";
const ACCOUNT_ID = "438465142992";
const ADMIN_POLICY_ARN = "arn:aws:iam::aws:policy/AdministratorAccess";
const PATIENT_POLICY_ARN = `arn:aws:iam::${ACCOUNT_ID}:policy/AWSPatientManagementPolicy`;

function run(cmd, options = {}) {
    return execSync(cmd, { stdio: "inherit", ...options });
}

try {
    // 1. AdministratorAccess をアタッチ
    console.log("🔑 Attaching AdministratorAccess...");
    run(
        `aws iam attach-user-policy \
      --user-name ${USER_NAME} \
      --policy-arn ${ADMIN_POLICY_ARN} \
      --profile ${ROOT_PROFILE}`
    );
    console.log("✅ AdministratorAccess attached");

    // 2. 権限反映待ち
    console.log("⏳ Waiting for permissions to propagate...");
    await new Promise((r) => setTimeout(r, 5000));

    // 3. S3 stateバケット作成
    console.log("\n🪣 Creating state bucket...");
    try {
        run(
            `aws s3api create-bucket \
        --bucket ${STATE_BUCKET} \
        --region ${REGION} \
        --create-bucket-configuration LocationConstraint=${REGION} \
        --profile ${ROOT_PROFILE}`,
            { stdio: "pipe" }
        );
        console.log("✅ State bucket created");
    } catch (e) {
        if (e.message.includes("BucketAlreadyOwnedByYou") || e.message.includes("BucketAlreadyExists")) {
            console.log("✅ State bucket already exists");
        } else {
            throw e;
        }
    }

    // 4. バケットポリシーを追加
    console.log("\n🔒 Adding bucket policy...");
    const bucketPolicy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: {
                    AWS: `arn:aws:iam::${ACCOUNT_ID}:user/${USER_NAME}`
                },
                Action: "s3:*",
                Resource: [
                    `arn:aws:s3:::${STATE_BUCKET}`,
                    `arn:aws:s3:::${STATE_BUCKET}/*`
                ]
            }
        ]
    });
    run(
        `aws s3api put-bucket-policy \
      --bucket ${STATE_BUCKET} \
      --policy '${bucketPolicy}' \
      --profile ${ROOT_PROFILE}`
    );
    console.log("✅ Bucket policy added");

    // 5. terraform init
    console.log("\n🔧 Running terraform init...");
    run("terraform init", { cwd: INFRA_DIR });

    // 6. tf files を一時退避
    console.log("\n📦 Temporarily moving tf files...");
    run("mv acm.tf acm.tf.bak", { cwd: INFRA_DIR });
    run("mv cloudfront_s3.tf cloudfront_s3.tf.bak", { cwd: INFRA_DIR });
    run("mv app_runner.tf app_runner.tf.bak", { cwd: INFRA_DIR });


    try {
        // 7. AWSPatientManagementPolicy をimport
        console.log("\n📥 Importing AWSPatientManagementPolicy...");
        try {
            run(
                `terraform import aws_iam_policy.patient_management ${PATIENT_POLICY_ARN}`,
                { cwd: INFRA_DIR }
            );
            console.log("✅ AWSPatientManagementPolicy imported");
        } catch (e) {
            console.log("ℹ️ Import error:", e.message);
        }

        // stateに入っているか確認
        const stateList = execSync("terraform state list", { cwd: INFRA_DIR, stdio: "pipe" })
            .toString();

        if (stateList.includes("aws_iam_policy.patient_management")) {
            console.log("✅ Already in state, skipping apply");
        } else {
            // 8. stateにない場合だけapply
            console.log("\n🚀 Applying AWSPatientManagementPolicy...");
            run(
                "terraform apply -target=aws_iam_policy.patient_management -auto-approve",
                { cwd: INFRA_DIR }
            );
            console.log("✅ AWSPatientManagementPolicy applied");
        }
    } finally {
        // 9. 必ず両方戻す
        console.log("\n📦 Restoring tf files...");
        run("mv acm.tf.bak acm.tf", { cwd: INFRA_DIR });
        run("mv cloudfront_s3.tf.bak cloudfront_s3.tf", { cwd: INFRA_DIR });
        run("mv app_runner.tf.bak app_runner.tf", { cwd: INFRA_DIR });
        console.log("✅ tf files restored");;
    }

    // 10. AWSPatientManagementPolicy をアタッチ
    run(
        `aws iam attach-user-policy \
      --user-name ${USER_NAME} \
      --policy-arn ${PATIENT_POLICY_ARN} \
      --profile ${PROFILE}`
    );
    console.log("✅ AWSPatientManagementPolicy attached to user");

    // 11. AdministratorAccess を即外す
    console.log("\n🔑 Detaching AdministratorAccess...");
    run(
        `aws iam detach-user-policy \
      --user-name ${USER_NAME} \
      --policy-arn ${ADMIN_POLICY_ARN} \
      --profile ${ROOT_PROFILE}`
    );
    console.log("✅ AdministratorAccess detached");

    console.log("\n🎉 Setup complete!");
    console.log("📝 次のステップ:");
    console.log("   npm run deploy:domain  → Route53作成");
    console.log("   npm run deploy:all     → 全リソース作成");

} catch (err) {
    console.error("❌ Error:", err.message);
    console.log("\n🔑 Detaching AdministratorAccess for safety...");
    try {
        execSync(
            `aws iam detach-user-policy \
        --user-name ${USER_NAME} \
        --policy-arn ${ADMIN_POLICY_ARN} \
        --profile ${ROOT_PROFILE}`,
            { stdio: "pipe" }
        );
        console.log("✅ AdministratorAccess detached");
    } catch {
        console.log("⚠️ Could not detach AdministratorAccess. Please detach manually.");
    }
    process.exit(1);
}
