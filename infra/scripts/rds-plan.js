import { execSync } from "child_process";

try {
    execSync("terraform plan", {
        cwd: "..",
        stdio: "inherit",
    });
} catch (err) {
    console.error("❌ Error:", err.message);
}
