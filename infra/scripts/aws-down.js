import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");

config({ path: resolve(INFRA_DIR, ".env") });

const PROFILE = process.env.AWS_PROFILE;
const REGION = "ap-northeast-1";
const env = { ...process.env };

const REQUIRED_VARS = ["AWS_PROFILE", "TF_VAR_db_name", "TF_VAR_db_username", "TF_VAR_db_password"];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
    console.error("❌ 必須の環境変数が infra/.env に設定されていません:");
    for (const k of missing) console.error(`   ${k}`);
    process.exit(1);
}

const mode = process.argv[2] || "all";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;

const CLUSTER = "patient-management-dev-cluster";
const SERVICE = "patient-management-dev-backend";

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

// ECS サービスを desired_count=0 → 削除する（ENI 残留による subnet 削除失敗を防ぐ）
async function drainAndDeleteEcsService() {
    try {
        const serviceArns = execSync(
            `aws ecs list-services --cluster ${CLUSTER} --query "serviceArns" --output text --region ${REGION} --profile ${PROFILE} 2>/dev/null`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        ).toString().trim();

        if (!serviceArns || !serviceArns.includes(SERVICE)) {
            console.log("  ℹ️  No ECS service found. Skipping.");
            return;
        }

        console.log(`  🔻 Scaling ${SERVICE} to 0...`);
        execSync(
            `aws ecs update-service --cluster ${CLUSTER} --service ${SERVICE} --desired-count 0 --region ${REGION} --profile ${PROFILE} --output text > /dev/null`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        );

        console.log("  ⏳ Waiting for tasks to stop (up to ~3 min)...");
        try {
            execSync(
                `aws ecs wait services-stable --cluster ${CLUSTER} --services ${SERVICE} --region ${REGION} --profile ${PROFILE}`,
                { cwd: INFRA_DIR, stdio: "pipe" }
            );
        } catch {
            console.warn("  ⚠️ services-stable wait timed out, proceeding to delete-service anyway");
        }

        console.log(`  🗑  Deleting service ${SERVICE}...`);
        execSync(
            `aws ecs delete-service --cluster ${CLUSTER} --service ${SERVICE} --force --region ${REGION} --profile ${PROFILE} --output text > /dev/null`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        );

        // state からも除外（Terraform destroy が二重削除しないように）
        stateRm("aws_ecs_service.backend");
        console.log("  ✅ ECS service deleted");
    } catch (err) {
        console.warn(`  ⚠️ Could not drain/delete ECS service: ${err.message}`);
    }
}

// ECR イメージを全削除（force_delete=true なら不要だが安全側）
function emptyEcrRepository(repoName) {
    try {
        const imagesJson = execSync(
            `aws ecr list-images --repository-name ${repoName} --query "imageIds" --output json --region ${REGION} --profile ${PROFILE} 2>/dev/null`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        ).toString().trim();

        if (!imagesJson || imagesJson === "[]") return;

        execSync(
            `aws ecr batch-delete-image --repository-name ${repoName} --image-ids '${imagesJson}' --region ${REGION} --profile ${PROFILE} --output text > /dev/null`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        );
        console.log(`  🗑  Emptied ECR repo: ${repoName}`);
    } catch {
        // 未作成 or 既に空
    }
}

// 孤立した Elastic IP を release（NAT Gateway 削除後に確実に課金停止させる）
function releaseOrphanedEips() {
    try {
        const json = execSync(
            `aws ec2 describe-addresses --filters "Name=tag:Name,Values=patient-management-dev-nat-eip" --query "Addresses" --output json --region ${REGION} --profile ${PROFILE}`,
            { cwd: INFRA_DIR, stdio: "pipe" }
        ).toString();

        const addresses = JSON.parse(json);
        for (const addr of addresses) {
            if (addr.AssociationId) {
                console.log(`  ℹ️  EIP ${addr.PublicIp} は ${addr.AssociationId} にアタッチ中（NAT GW 残存？）`);
                continue;
            }
            execSync(
                `aws ec2 release-address --allocation-id ${addr.AllocationId} --region ${REGION} --profile ${PROFILE}`,
                { cwd: INFRA_DIR, stdio: "pipe" }
            );
            console.log(`  ✅ Released orphaned EIP: ${addr.PublicIp} (${addr.AllocationId})`);
        }
    } catch (err) {
        console.warn(`  ⚠️ Could not check/release EIP: ${err.message}`);
    }
}

try {
    if (mode === "domain") {
        // Route53 ゾーンのみ削除（インフラはそのまま残す）
        console.log("\n🗑️  Destroying Route53 zones only...");
        await destroyWithRetry(
            "terraform destroy -target=aws_route53_zone.front -target=aws_route53_zone.api -auto-approve -input=false -lock=false -refresh=false",
            "Route53 destroy"
        );
        console.log("\n✅ Route53 zones destroyed!");
        console.log("📝 Note: インフラ（RDS / ACM / S3+CloudFront 等）はそのまま残っています");
    } else {
        // Route53 を state から除外してから全破棄（DNS は AWS 上に保持される）
        console.log("\n🗂  Removing Route53 from Terraform state (preserving DNS in AWS)...");
        stateRm("aws_route53_zone.front", "aws_route53_zone.api");

        // ECS サービスを CLI で先に空にして削除（ENI 残留 → subnet 削除失敗を防ぐ）
        console.log("\n🗑️  Draining and deleting ECS service via CLI (if exists)...");
        await drainAndDeleteEcsService();

        // ECR イメージを空に（force_delete=true でも保険）
        console.log("\n🗑️  Emptying ECR repository (if exists)...");
        emptyEcrRepository("patient-management-dev-backend");

        // IAM ポリシーを先にデタッチ（アタッチされたまま削除しようとすると 409 ConflictError）
        console.log("\n🔓 Detaching IAM policies before destroy...");
        detachIamPolicy("AWSPatientManagementPolicy");

        console.log("\n🗑️  Destroying all infrastructure (excluding Route53)...");
        await destroyWithRetry(
            "terraform destroy -auto-approve -input=false -lock=false -refresh=false",
            "Infrastructure destroy"
        );

        // destroy 後の保険: 孤立 EIP（NAT GW 削除に失敗してもアタッチが外れていれば release）
        console.log("\n🔍 Checking for orphaned Elastic IPs (NAT Gateway 残存対策)...");
        releaseOrphanedEips();

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
