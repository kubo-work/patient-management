import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INFRA_DIR = resolve(__dirname, "..");

config({ path: resolve(INFRA_DIR, ".env") });

const env = { ...process.env };

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

try {
    if (mode === "domain") {
        console.log("\n🚀 Applying Route53 only...");
        execSync(
            "terraform apply -target=aws_route53_zone.front -target=aws_route53_zone.api -auto-approve",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );
        console.log("\n✅ Route53 created!");
        console.log("📝 次のステップ:");
        console.log("   1. terraform output front_name_servers / api_name_servers でNSレコードを確認");
        console.log("   2. お名前.comのネームサーバーをRoute53に変更");
        console.log("   3. DNS伝播後に npm run aws-apply を実行");

    } else {
        // Step0: for_each の原因ファイルを退避してから既存リソースをimport
        console.log("\n📦 Temporarily moving app_runner_domain_validation.tf...");
        execSync("mv app_runner_domain_validation.tf app_runner_domain_validation.tf.bak", { cwd: INFRA_DIR, env });

        try {
            console.log("\n🔍 Importing existing AWS resources into Terraform state...");
            tryImport("aws_iam_role.app_runner", "pm-dev-app-runner-role");
            tryImport("aws_iam_role.app_runner_instance", "pm-dev-app-runner-instance-role");
            tryImport("aws_apprunner_connection.github", "pm-dev-github-connection");
            tryImport("aws_db_parameter_group.postgres", "patient-management-dev-parameter-group");
            tryImport("aws_secretsmanager_secret.database_url", "patient-management-dev-database-url");

            // Route53 ゾーンが既に存在する場合は import（同名ゾーンが重複して作られるのを防ぐ）
            const route53Domains = [
                { resource: "aws_route53_zone.front", name: "aws.patient-management-kubo-works-projects.com." },
                { resource: "aws_route53_zone.api",   name: "api-aws.patient-management-kubo-works-projects.com." },
            ];
            for (const { resource, name } of route53Domains) {
                try {
                    const zoneId = execSync(
                        `aws route53 list-hosted-zones --query "HostedZones[?Name=='${name}'].Id" --output text --profile ${process.env.AWS_PROFILE}`,
                        { cwd: INFRA_DIR, stdio: "pipe", env }
                    ).toString().trim().split("\n")[0].replace("/hostedzone/", "");
                    if (zoneId) tryImport(resource, zoneId);
                } catch {
                    // ゾーンが存在しない場合は無視
                }
            }

            // S3 フロントバケットが既に存在する場合は import
            tryImport("aws_s3_bucket.front", "aws.patient-management-kubo-works-projects.com");

            // RDS が自動生成した CloudWatch Log Group を import
            try {
                const rdsId = execSync(
                    `aws rds describe-db-instances --query "DBInstances[0].DBInstanceIdentifier" --output text --profile ${process.env.AWS_PROFILE}`,
                    { cwd: INFRA_DIR, stdio: "pipe", env }
                ).toString().trim();

                if (rdsId && rdsId !== "None" && rdsId !== "") {
                    console.log(`🔍 Found RDS instance: ${rdsId}`);
                    tryImport("aws_cloudwatch_log_group.rds_postgresql", `/aws/rds/instance/${rdsId}/postgresql`);
                    tryImport("aws_cloudwatch_log_group.rds_upgrade", `/aws/rds/instance/${rdsId}/upgrade`);
                }
            } catch {
                // RDS が存在しない場合は無視
            }

            // App Runner サービスが既に存在する場合は import（CREATE_FAILED 含む）
            try {
                const serviceArn = execSync(
                    `aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='patient-management-dev-app-runner'].ServiceArn" --output text --profile ${process.env.AWS_PROFILE}`,
                    { cwd: INFRA_DIR, stdio: "pipe", env }
                ).toString().trim();

                if (serviceArn) {
                    console.log(`🔍 Found existing App Runner service: ${serviceArn}`);
                    tryImport("aws_apprunner_service.app", serviceArn);
                }
            } catch {
                // サービスが存在しない場合は無視
            }
        } finally {
            console.log("\n📦 Restoring app_runner_domain_validation.tf...");
            execSync("mv app_runner_domain_validation.tf.bak app_runner_domain_validation.tf", { cwd: INFRA_DIR, env });
            console.log("✅ app_runner_domain_validation.tf restored");
        }

        // Step1: ACM証明書を先に作成（for_each の依存を解決）
        console.log("\n🚀 Step1: Applying ACM certificates...");
        execSync(
            "terraform apply -target=aws_acm_certificate.front -target=aws_acm_certificate.api -auto-approve",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step1.5: インスタンスロールに Secrets / CloudWatch 権限を付与（Step3 より前に必須）
        // Step3 が CREATE_FAILED だと Step4 に進めず、ここを通らないと GetSecretValue が永遠に付かない
        console.log("\n🚀 Step1.5: Applying App Runner instance IAM policies (secrets + CloudWatch logs)...");
        execSync(
            "terraform apply -target=aws_iam_role_policy.app_runner_instance_secrets -target=aws_iam_role_policy.app_runner_instance_cloudwatch -auto-approve",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step2: シークレットの値（バージョン）を先に作成（App Runner起動前に AWSCURRENT が必要）
        console.log("\n🚀 Step2: Applying Secrets Manager secret version...");
        execSync(
            "terraform apply -target=aws_secretsmanager_secret.database_url -target=aws_secretsmanager_secret_version.database_url -auto-approve",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step3: App Runnerサービスとカスタムドメインを作成
        console.log("\n🚀 Step3: Applying App Runner service and custom domain...");
        execSync(
            "terraform apply -target=aws_apprunner_service.app -target=aws_apprunner_custom_domain_association.api -auto-approve",
            { cwd: INFRA_DIR, stdio: "inherit", env }
        );

        // Step4: 残りの全リソースを作成
        console.log("\n🚀 Step4: Applying all remaining resources...");
        execSync("terraform apply -auto-approve", {
            cwd: INFRA_DIR,
            stdio: "inherit",
            env,
        });

        const appRunnerUrl = execSync(
            "terraform output -raw app_runner_url",
            { cwd: INFRA_DIR, env }
        ).toString().trim();

        console.log("\n🎉 Infrastructure is ready!");
        console.log(`\n🚀 App Runner URL (backend): ${appRunnerUrl}`);
        console.log("\n📝 Next steps:");
        console.log("   1. AWSコンソール → App Runner → GitHub connectionsで認証を完了");
        console.log("   2. GitHub Actions に以下の Secrets を設定:");
        console.log("      AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY");
        console.log("      S3_BUCKET_NAME / CLOUDFRONT_DISTRIBUTION_ID");
        console.log("   3. mainブランチにpushするとApp Runnerがバックエンドを自動デプロイ");
        console.log("      フロントエンドは GitHub Actions が S3 へ自動デプロイ");
    }

} catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
}
