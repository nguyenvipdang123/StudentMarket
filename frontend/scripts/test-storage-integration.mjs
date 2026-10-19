import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["scripts/integration-test.mjs"], { cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_STORAGE: "supabase" }, windowsHide: true, stdio: "inherit" });
child.on("error", () => { console.error("Could not start the isolated storage test."); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
