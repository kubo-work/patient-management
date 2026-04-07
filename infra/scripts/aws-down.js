import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");

config({ path: resolve(INFRA_DIR, ".env") });

const PROFILE = process.env.AWS_PROFILE;
const env = { ...process.env };

const mode = process.argv[2] || "all";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;

function run(cmd, opts = {}) {
    return execSync(cmd, { cwd: INFRA_DIR, stdio: "inherit", env, ...opts });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// リトライ付き terraform destroy
async function destroyWithRetry(cmd, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            run(cmd);
            return;
        } catch (err) {
            if (attempt < MAX_RETRIES) {
                console.warn(`\n⚠️  ${label} attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                console.warn("   (Terraform は冪等なので、削除済みリソースはスキップされます)");
                await sleep(RETRY_DELAY_MS);
            } else {
                throw err;
            }
        }
    }
}

// terraform state から指定リソースを削除（存在しない場合は無視）
function stateRm(...resources) {
    for (const res of resources) {
        try {
            run(`terraform state rm '${res}'`, { stdio: "pipe" });
            console.log(`  🗂  Removed from state: ${res}`);
        } catch {
            // すでに state にない場合は無視
        }
    }
}

// IAM ポリシーを全アタッチ先からデタッチ（削除前の前処理）
function detachIamPolicy(policyName) {
    try {
        const accountId = execSync(
            `aws sts get-caller-identity --query Account --output text --profile ${PROFILE}`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        ).toString().trim();

        const policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;

        const entities = JSON.parse(
            execSync(
                `aws iam list-entities-for-policy --policy-arn ${policyArn} --profile ${PROFILE} --output json`,
                { cwd: INFRA_DIR, stdio: "pipe" }
            ).toString()
        );

        for (const { UserName } of (entities.PolicyUsers ?? [])) {
            execSync(`aws iam detach-user-policy --user-name ${UserName} --policy-arn ${policyArn} --profile ${PROFILE}`, { cwd: INFRA_DIR, stdio: "pipe" });
            console.log(`  🔓 Detached from user: ${UserName}`);
        }
        for (const { RoleName } of (entities.PolicyRoles ?? [])) {
            execSync(`aws iam detach-role-policy --role-name ${RoleName} --policy-arn ${policyArn} --profile ${PROFILE}`, { cwd: INFRA_DIR, stdio: "pipe" });
            console.log(`  🔓 Detached from role: ${RoleName}`);
        }
        for (const { GroupName } of (entities.PolicyGroups ?? [])) {
            execSync(`aws iam detach-group-policy --group-name ${GroupName} --policy-arn ${policyArn} --profile ${PROFILE}`, { cwd: INFRA_DIR, stdio: "pipe" });
            console.log(`  🔓 Detached from group: ${GroupName}`);
        }

        console.log(`  ✅ All entities detached from policy: ${policyName}`);
    } catch (err) {
        console.warn(`  ⚠️ Could not detach IAM policy ${policyName}: ${err.message}`);
    }
}

try {
    if (mode === "domain") {
        // Route53ゾーンのみ削除（インフラはそのまま残す）
        console.log("\n🗑️  Destroying Route53 zones only...");
        await destroyWithRetry(
            "terraform destroy -target=aws_route53_zone.front -target=aws_route53_zone.api -auto-approve -lock=false -refresh=false",
            "Route53 destroy"
        );
        console.log("\n✅ Route53 zones destroyed!");
        console.log("📝 Note: インフラ（RDS / ACM / S3+CloudFront 等）はそのまま残っています");

    } else {
        // Route53 を state から除外してから全破棄（DNS は AWS 上に保持される）
        console.log("\n🗂  Removing Route53 from Terraform state (preserving DNS in AWS)...");
        stateRm("aws_route53_zone.front", "aws_route53_zone.api");

        // App Runner サービスを CLI で削除（CREATE_FAILED 等 Terraform が検知できない状態でも確実に消す）
        console.log("\n🗑️  Deleting App Runner service via CLI (if exists)...");
        try {
            const serviceArn = execSync(
                `aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='patient-management-dev-app-runner'].ServiceArn" --output text --region ap-northeast-1 --profile ${PROFILE}`,
                { cwd: INFRA_DIR, stdio: "pipe" }
            ).toString().trim();

            if (serviceArn) {
                console.log(`  🔍 Found: ${serviceArn}`);
                execSync(
                    `aws apprunner delete-service --service-arn ${serviceArn} --region ap-northeast-1 --profile ${PROFILE}`,
                    { cwd: INFRA_DIR, stdio: "pipe" }
                );
                console.log("  ✅ Delete requested. Waiting 30s for App Runner to finish...");
                await sleep(30_000);
                // state からも除去（Terraform が二重削除しないよう）
                stateRm("aws_apprunner_service.app", "aws_apprunner_custom_domain_association.api");
            } else {
                console.log("  ℹ️  No App Runner service found. Skipping.");
            }
        } catch (err) {
            console.warn(`  ⚠️ Could not delete App Runner service: ${err.message}`);
        }

        // IAM ポリシーを先にデタッチ（アタッチされたまま削除しようとすると 409 ConflictError）
        console.log("\n🔓 Detaching IAM policies before destroy...");
        detachIamPolicy("AWSPatientManagementPolicy");

        console.log("\n🗑️  Destroying all infrastructure (excluding Route53)...");
        await destroyWithRetry(
            "terraform destroy -auto-approve -lock=false -refresh=false",
            "Infrastructure destroy"
        );

        console.log("\n✅ Infrastructure destroyed!");
        console.log("📝 Note: Route53ゾーンは AWS 上に保持されています（state からは除外済み）");
        console.log("   ドメインも削除する場合は npm run aws-down-domain を実行してください");
        console.log("   再構築する場合は npm run aws-apply-domain → npm run aws-apply の順に実行してください");
        console.log("   S3バケットにファイルがある場合は先に手動で空にしてから destroy してください");
    }

} catch (err) {
    console.error("\n❌ Error:", err.message);
    console.error("\n💡 ネットワーク接続エラーの場合、以下を試してください:");
    console.error("   1. 再度 npm run aws-down を実行（Terraform は冪等です）");
    console.error("   2. AWS コンソールで手動削除後、terraform state rm <resource> でstateを整理");
    process.exit(1);
}
