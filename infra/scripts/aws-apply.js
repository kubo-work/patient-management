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

    // ローカルの.envだけ更新（開発用）
    const envPath = path.resolve("../../backend/.env");
    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf-8");
        content = content
            .split("\n")
            .filter((line) => !line.startsWith(DATABASE_KEY))
            .join("\n");
    }
    if (content && !content.endsWith("\n")) content += "\n";
    content += `${DATABASE_KEY}=${dbUrl}\n`;
    fs.writeFileSync(envPath, content);
    console.log("✅ .env updated with database URL");

    console.log("\n🎉 Infrastructure is ready!");
    console.log("\n📝 Next steps:");
    console.log("   1. AWSコンソール → App Runner → GitHub connectionsで認証を完了");
    console.log("   2. mainブランチにpushするとApp Runnerが自動デプロイ＆マイグレーション実行");
} catch (err) {
    console.error("❌ Error:", err.message);
}
