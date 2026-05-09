import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(INFRA_DIR, "..");

config({ path: resolve(INFRA_DIR, ".env") });

// backend/.env の DATABASE_URL を SUPABASE_URL として自動取得
// （infra/.env に TF_VAR_supabase_url が未設定の場合のみ）
if (!process.env.TF_VAR_supabase_url) {
    const backendEnv = config({ path: resolve(REPO_ROOT, "backend", ".env"), override: false });
    if (backendEnv.parsed?.DATABASE_URL) {
        process.env.TF_VAR_supabase_url = backendEnv.parsed.DATABASE_URL;
    }
}

const env = { ...process.env };
const PROFILE = process.env.AWS_PROFILE;

const REQUIRED_VARS = [
    "AWS_PROFILE",
    "TF_VAR_project",
    "TF_VAR_environment",
    "TF_VAR_db_name",
    "TF_VAR_db_username",
    "TF_VAR_db_password",
    "TF_VAR_client_url",
    "TF_VAR_jwt_secret_key",
    // TF_VAR_supabase_url は backend/.env の DATABASE_URL から自動取得するため任意
];
const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
    console.error("❌ 必須の環境変数が infra/.env に設定されていません:");
    for (const k of missing) console.error(`   ${k}`);
    process.exit(1);
}

const dbPassword = process.env.TF_VAR_db_password ?? "";
if (dbPassword.length < 8) {
    console.error("❌ TF_VAR_db_password は 8 文字以上にしてください（RDS の制約）");
    process.exit(1);
}

const mode = process.argv[2] || "all";

// AWSに既存のリソースをstateにimportする（エラーは無視）
function tryImport(resource, id) {
    try {
        execSync(`terraform import ${resource} ${id}`, {
            cwd: INFRA_DIR,
            stdio: "pipe",
            env,
        });
        console.log(`✅ Imported: ${resource}`);
    } catch {
        // すでにstateにある or 存在しない場合は無視
    }
}

// 指定リソース名がすでに state に存在するか
function isInState(resource) {
    try {
        const list = execSync("terraform state list", {
            cwd: INFRA_DIR,
            stdio: "pipe",
            env,
        }).toString();
        return list.split("\n").includes(resource);
    } catch {
        return false;
    }
}

// Route53 ゾーンの重複検出（同名ゾーンが AWS 上に複数あったら apply 中断）
function ensureSingleHostedZone(name) {
    const raw = execSync(
        `aws route53 list-hosted-zones --query "HostedZones[?Name=='${name}'].Id" --output text --profile ${PROFILE}`,
        { cwd: INFRA_DIR, stdio: "pipe", env }
    ).toString().trim();

    if (!raw) return null; // 未作成

    const zoneIds = raw
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => s.replace("/hostedzone/", ""));

    if (zoneIds.length > 1) {
        console.error(`\n❌ Duplicate Route53 hosted zones detected for "${name}":`);
        for (const id of zoneIds) {
            console.error(`     - ${id}`);
        }
        console.error("   AWS コンソール で不要な方を削除してから再実行してください。");
        console.error("   （NS レコードに対応する 1 つを残す）");
        process.exit(1);
    }

    return zoneIds[0];
}

// Route53 ゾーンを厳格に import（silent fail 禁止）
// import 失敗 → 重複ゾーン生成リスクのため即中断する
function importRoute53ZoneSafe(resource, name) {
    if (isInState(resource)) {
        // すでに state にあれば何もしない（apply で同じリソースが扱われる）
        return;
    }
    const zoneId = ensureSingleHostedZone(name);
    if (!zoneId) {
        // AWS 上にゾーンが無いので新規作成させる（import しない）
        return;
    }

    try {
        execSync(`terraform import ${resource} ${zoneId}`, {
            cwd: INFRA_DIR,
            stdio: "pipe",
            env,
        });
        console.log(`✅ Imported: ${resource} (${zoneId})`);
    } catch (err) {
        console.error(`\n❌ Route53 ゾーン import 失敗: ${resource} (${zoneId})`);
        console.error("   このまま apply を続けると AWS 上に重複ゾーンが作られるため中断します。");
        console.error(`   原因: ${err.message.split("\n").slice(0, 5).join("\n   ")}`);
        console.error("\n💡 対処:");
        console.error("   1. AWS 認証エラーなら infra/.env を確認");
        console.error("   2. 既に state にある場合は terraform state list で確認");
        console.error("   3. それ以外の理由なら手動で terraform import を実行してから再実行");
        process.exit(1);
    }

    // 念のため import 後に state に存在することを確認
    if (!isInState(resource)) {
        console.error(`\n❌ Route53 ゾーン import 後に state へ反映されていません: ${resource}`);
        console.error("   重複ゾーン生成リスクがあるため apply を中断します。");
        process.exit(1);
    }
}

try {
    // S3 バックエンドへの再接続が必要な場合に備えて毎回 init
    console.log("🔧 Running terraform init...");
    execSync("terraform init -reconfigure -input=false", {
        cwd: INFRA_DIR,
        stdio: "inherit",
        env,
    });

    if (mode === "domain") {
        console.log("\n🚀 Applying Route53 only...");

        // domain モードでも apply 前に重複ゾーン検出は行う（誤って 2 つ目を作らない）
        importRoute53ZoneSafe("aws_route53_zone.front", "aws.patient-management-kubo-works-projects.com.");
        importRoute53ZoneSafe("aws_route53_zone.api", "api-aws.patient-management-kubo-works-projects.com.");

        execSync(
            "terraform apply -target=aws_route53_zone.front -target=aws_route53_zone.api -auto-approve -input=false",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );
        console.log("\n✅ Route53 created!");
        console.log("📝 次のステップ:");
        console.log("   1. terraform output front_name_servers / api_name_servers でNSレコードを確認");
        console.log("   2. お名前.comのネームサーバーをRoute53に変更");
        console.log("   3. DNS伝播後に npm run aws-apply を実行");
    } else {
        console.log("\n🔍 Importing existing AWS resources into Terraform state...");

        // IAM
        tryImport("aws_iam_role.ecs_task_execution", `${process.env.TF_VAR_project ?? "patient-management"}-${process.env.TF_VAR_environment ?? "dev"}-ecs-task-execution-role`);
        tryImport("aws_iam_role.ecs_task", `${process.env.TF_VAR_project ?? "patient-management"}-${process.env.TF_VAR_environment ?? "dev"}-ecs-task-role`);

        // RDS 関連の付随リソース
        tryImport("aws_db_parameter_group.postgres", "patient-management-dev-parameter-group");
        tryImport("aws_secretsmanager_secret.database_url", "patient-management-dev-database-url");

        // S3 フロントバケット
        tryImport("aws_s3_bucket.front", "aws.patient-management-kubo-works-projects.com");

        // ECR リポジトリ
        try {
            const repoName = execSync(
                `aws ecr describe-repositories --repository-names patient-management-dev-backend --query "repositories[0].repositoryName" --output text --profile ${PROFILE} 2>/dev/null`,
                { cwd: INFRA_DIR, stdio: "pipe", env }
            ).toString().trim();
            if (repoName && repoName !== "None") {
                tryImport("aws_ecr_repository.backend", repoName);
            }
        } catch {
            // 未作成
        }

        // ECS Cluster / Service
        try {
            const clusterArn = execSync(
                `aws ecs describe-clusters --clusters patient-management-dev-cluster --query "clusters[0].clusterArn" --output text --profile ${PROFILE}`,
                { cwd: INFRA_DIR, stdio: "pipe", env }
            ).toString().trim();
            if (clusterArn && clusterArn !== "None" && clusterArn !== "") {
                tryImport("aws_ecs_cluster.main", "patient-management-dev-cluster");
                tryImport("aws_ecs_service.backend", "patient-management-dev-cluster/patient-management-dev-backend");
            }
        } catch {
            // 未作成
        }

        // CloudWatch Logs (ECS)
        tryImport("aws_cloudwatch_log_group.ecs_backend", "/ecs/patient-management-dev-backend");

        // Step 1/5: ACM 証明書（for_each の依存を解決するため先に作成）
        console.log("\n🚀 [1/5] ACM 証明書を作成中...");
        execSync(
            "terraform apply -target=aws_acm_certificate.front -target=aws_acm_certificate.api -auto-approve -input=false",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // ACM が state に入ったことで acm.tf の for_each が解決できるようになるため、
        // ここで Route53 ゾーンを import する（初期 import ブロックで実行すると for_each エラーになる）
        console.log("\n🔍 Route53 ゾーンを import 中（重複チェック付き）...");
        importRoute53ZoneSafe("aws_route53_zone.front", "aws.patient-management-kubo-works-projects.com.");
        importRoute53ZoneSafe("aws_route53_zone.api", "api-aws.patient-management-kubo-works-projects.com.");

        // Step 2/5: Secrets Manager（ECS 起動時に AWSCURRENT が必要）
        console.log("\n🚀 [2/5] Secrets Manager を作成中...");
        execSync(
            "terraform apply -target=aws_secretsmanager_secret.database_url -target=aws_secretsmanager_secret_version.database_url -auto-approve -input=false",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step 3/5: ECR（タスク定義が repository_url を参照するため先に作成）
        console.log("\n🚀 [3/5] ECR リポジトリを作成中...");
        execSync(
            "terraform apply -target=aws_ecr_repository.backend -auto-approve -input=false",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step 4/5: RDS を先に作成（ECS タスク定義が DB エンドポイントを参照するため先に作成）
        console.log("\n🚀 [4/5] RDS を作成中...");
        execSync(
            "terraform apply -target=aws_db_instance.postgres -target=aws_db_parameter_group.postgres -target=aws_db_subnet_group.postgres -auto-approve -input=false",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step 5/5: 残りの全リソースを作成
        console.log("\n🚀 [5/5] 残りのリソースを作成中...");
        execSync("terraform apply -auto-approve -input=false", {
            cwd: INFRA_DIR,
            stdio: "inherit",
            env,
        });

        const albDns = execSync(
            "terraform output -raw alb_dns_name",
            { cwd: INFRA_DIR, env }
        ).toString().trim();
        const apiUrl = execSync(
            "terraform output -raw api_url",
            { cwd: INFRA_DIR, env }
        ).toString().trim();
        const ecrUrl = execSync(
            "terraform output -raw ecr_repository_url",
            { cwd: INFRA_DIR, env }
        ).toString().trim();

        console.log("\n🎉 Infrastructure is ready!");
        console.log(`\n🌐 ALB DNS: ${albDns}`);
        console.log(`🌐 API URL: ${apiUrl}`);
        console.log(`📦 ECR:     ${ecrUrl}`);
        console.log("\n📝 Next steps:");
        console.log("   1. npm run aws-build-push でバックエンドの Docker イメージをビルド & デプロイ");
        console.log("   2. GitHub Actions に AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET_NAME / CLOUDFRONT_DISTRIBUTION_ID を設定");
        console.log("   3. main ブランチへの push でフロントエンドが S3 へ自動デプロイ");
    }
} catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
}
