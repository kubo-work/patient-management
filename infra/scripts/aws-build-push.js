// バックエンド Docker イメージを ECR に build & push し、
// ECS サービスを force-new-deployment で更新するスクリプト
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(INFRA_DIR, "..");

config({ path: resolve(INFRA_DIR, ".env") });

const PROFILE = process.env.AWS_PROFILE;
const REGION = "ap-northeast-1";
const env = { ...process.env };

if (!PROFILE) {
    console.error("❌ AWS_PROFILE が設定されていません。");
    console.error("   infra/.env に以下を追加してください:");
    console.error("   AWS_PROFILE=patient");
    process.exit(1);
}

function run(cmd, opts = {}) {
    return execSync(cmd, { stdio: "inherit", env, ...opts });
}

function capture(cmd, opts = {}) {
    return execSync(cmd, { stdio: "pipe", env, ...opts }).toString().trim();
}

try {
    // 1. terraform output から ECR URL を取得
    console.log("🔍 Resolving ECR repository URL...");
    const ecrUrl = capture("terraform output -raw ecr_repository_url", { cwd: INFRA_DIR });
    if (!ecrUrl) throw new Error("ECR repository URL not found. Run aws-apply first.");
    console.log(`   ECR: ${ecrUrl}`);

    const registry = ecrUrl.split("/")[0]; // <account>.dkr.ecr.<region>.amazonaws.com

    // 2. ECR ログイン
    console.log("\n🔐 Logging into ECR...");
    run(`aws ecr get-login-password --region ${REGION} --profile ${PROFILE} | docker login --username AWS --password-stdin ${registry}`);

    // 3. タグ決定（git short SHA があれば使用、なければ timestamp）
    let tag;
    try {
        tag = capture("git rev-parse --short HEAD", { cwd: REPO_ROOT });
    } catch {
        tag = `build-${Date.now()}`;
    }
    console.log(`\n🏷  Image tag: ${tag}`);

    // 4. docker build (linux/amd64 を明示。Apple Silicon でも Fargate x86_64 用に統一)
    console.log("\n🔨 Building image...");
    run(
        `docker build --platform linux/amd64 -t ${ecrUrl}:${tag} -t ${ecrUrl}:latest -f backend/Dockerfile .`,
        { cwd: REPO_ROOT }
    );

    // 5. push
    console.log("\n📤 Pushing image...");
    run(`docker push ${ecrUrl}:${tag}`);
    run(`docker push ${ecrUrl}:latest`);

    // 6. ECS サービス強制再デプロイ
    console.log("\n🚀 Forcing ECS service redeploy...");
    const cluster = capture("terraform output -raw ecs_cluster_name", { cwd: INFRA_DIR });
    const service = capture("terraform output -raw ecs_service_name", { cwd: INFRA_DIR });
    run(
        `aws ecs update-service --cluster ${cluster} --service ${service} --force-new-deployment --region ${REGION} --profile ${PROFILE} --output text > /dev/null`
    );

    console.log("\n✅ Build & deploy triggered!");
    console.log("\n📊 状況確認:");
    console.log(`   aws ecs describe-services --cluster ${cluster} --services ${service} --region ${REGION} --profile ${PROFILE}`);
    console.log(`   aws logs tail /ecs/patient-management-dev-backend --follow --region ${REGION} --profile ${PROFILE}`);
} catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
}
