// CodeBuildを起動してマイグレーションを実行するスクリプト
import { execSync } from "child_process";

try {
    console.log("🗄 Triggering CodeBuild migration...");

    const result = execSync(
        "aws codebuild start-build --project-name patient-management-dev-migrate --region ap-northeast-1 --profile patient",
        {
            encoding: "utf-8",
        }
    );

    const buildId = JSON.parse(result).build.id;
    console.log("✅ Migration build started!");
    console.log(`Build ID: ${buildId}`);
    console.log("\n💡 To check build status:");
    console.log(`   aws codebuild batch-get-builds --ids ${buildId}`);
    console.log("\n📊 Or visit AWS Console:");
    console.log("   https://console.aws.amazon.com/codesuite/codebuild/projects");
} catch (err) {
    console.error("❌ Error:", err.message);
}
