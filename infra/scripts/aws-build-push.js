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

// backend/.env の DATABASE_URL を SUPABASE_URL として自動取得
if (!process.env.TF_VAR_supabase_url) {
    const backendEnv = config({ path: resolve(REPO_ROOT, "backend", ".env"), override: false });
    if (backendEnv.parsed?.DATABASE_URL) {
        process.env.TF_VAR_supabase_url = backendEnv.parsed.DATABASE_URL;
    }
}

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

    // 6. ECS サービス強制再デプロイ（最新タスク定義を明示指定）
    console.log("\n🚀 Forcing ECS service redeploy with latest task definition...");
    const cluster = capture("terraform output -raw ecs_cluster_name", { cwd: INFRA_DIR });
    const service = capture("terraform output -raw ecs_service_name", { cwd: INFRA_DIR });

    // ignore_changes = [task_definition] のため terraform apply はサービスを更新しない。
    // ここで最新タスク定義 ARN を取得してサービスに明示的に反映させる。
    const taskDefFamily = cluster.replace("-cluster", "-backend");
    const latestTaskDefArn = capture(
        `aws ecs describe-task-definition --task-definition ${taskDefFamily} --query taskDefinition.taskDefinitionArn --output text --region ${REGION} --profile ${PROFILE}`
    );
    console.log(`   Task definition: ${latestTaskDefArn}`);
    run(
        `aws ecs update-service --cluster ${cluster} --service ${service} --task-definition ${latestTaskDefArn} --force-new-deployment --region ${REGION} --profile ${PROFILE} --output text > /dev/null`
    );

    console.log("\n✅ Build & deploy triggered!");
    console.log("\n📊 状況確認:");
    console.log(`   aws ecs describe-services --cluster ${cluster} --services ${service} --region ${REGION} --profile ${PROFILE}`);
    console.log(`   aws logs tail /ecs/patient-management-dev-backend --follow --region ${REGION} --profile ${PROFILE}`);
} catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
}
