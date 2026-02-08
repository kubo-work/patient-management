// terraform destroyを実行するスクリプト
// ※ backend/.envからDATABASE_KEYを削除する
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { DATABASE_KEY } from "./const.js";

try {
    console.log("Destroying Terraform...");

    execSync("terraform destroy -auto-approve", {
        cwd: "..",
        stdio: "inherit",
    });

    const envPath = path.resolve("../../backend/.env");

    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");

        const updated = content
            .split("\n")
            .filter((line) => !line.startsWith(DATABASE_KEY))
            .join("\n");

        fs.writeFileSync(envPath, updated);

        console.log(`🧹 ${DATABASE_KEY} removed from ../../backend/.env`);
    }

    console.log("✅ RDS destroyed");
} catch (err) {
    console.error("❌ Error:", err.message);
}
