import { execSync } from "child_process";
import fs from "fs";
try {
    console.log("Destroying Terraform...");

    execSync("terraform destroy -auto-approve", {
        cwd: "..",
        stdio: "inherit",
    });

    console.log("✅ RDS destroyed");
} catch (err) {
    console.error("❌ Error:", err.message);
}
