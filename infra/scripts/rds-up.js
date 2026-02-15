// terraform applyを実行し、GitHub Secretsも設定するスクリプト
// ※ backend/.envにDATABASE_KEYを追加する
// ※ GitHub SecretsにAWS_ROLE_ARNを設定する（GitHub Actions用）
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { DATABASE_KEY } from "./const.js";

try {
    console.log("Applying Terraform...");
    execSync("terraform apply -auto-approve", {
        cwd: "..",
        stdio: "inherit",
    });

    console.log("Getting database URL...");
    const dbUrl = execSync(
        "terraform output -raw database_url",
        { cwd: ".." }
    )
        .toString()
        .trim();

    const envPath = path.resolve("../../backend/.env");

    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf-8");
        // 既存のDATABASE_KEYを削除
        content = content
            .split("\n")
            .filter((line) => !line.startsWith(DATABASE_KEY))
            .join("\n");
    }

    // DATABASE_KEYを追加
    if (content && !content.endsWith("\n")) {
        content += "\n";
    }
    content += `${DATABASE_KEY}=${dbUrl}\n`;

    fs.writeFileSync(envPath, content);

    console.log("✅ .env updated with database URL");
    
    // GitHub Secretsに DATABASE_URL を設定
    console.log("\nSetting up GitHub Actions...");
    try {
        // GitHub CLIで DATABASE_URL を設定
        execSync(`echo "${dbUrl}" | gh secret set DATABASE_URL --body-stdin`, {
            stdio: "inherit",
        });
        
        console.log("✅ GitHub Secret DATABASE_URL configured");
    } catch (ghError) {
        console.warn("⚠️  Could not set GitHub Secret automatically");
        console.warn("   Please run manually:");
        console.warn(`   terraform output -raw database_url | gh secret set DATABASE_URL --body-stdin`);
        console.warn(`   Error: ${ghError.message}`);
    }
    
    console.log("\n🎉 RDS infrastructure is ready!");
    console.log("\n📝 Next steps:");
    console.log("   1. Run 'npm run rds-migrate' to apply database schema (local)");
    console.log("   2. Or use GitHub Actions: Go to Actions tab > Database Migration > Run workflow");
} catch (err) {
    console.error("❌ Error:", err.message);
}
