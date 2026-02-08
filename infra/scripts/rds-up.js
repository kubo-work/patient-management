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
    console.log("🎉 RDS infrastructure is ready!");
    console.log("\n💡 Run 'npm run rds-migrate' to apply database schema");
} catch (err) {
    console.error("❌ Error:", err.message);
}
