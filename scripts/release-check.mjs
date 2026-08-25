import { spawn } from "node:child_process";

if (!process.env.SKILLBASE_SITE_URL) {
  console.error("SKILLBASE_SITE_URL이 필요합니다. .env.example을 참고하세요.");
  process.exit(2);
}

const child = spawn(process.execPath, ["scripts/health-check.mjs"], {
  stdio: "inherit",
  env: { ...process.env, SKILLBASE_REQUIRE_SUMMARY_PROVIDER: "true" },
});

child.on("error", (error) => {
  console.error(`출시 점검을 실행하지 못했습니다: ${error.message}`);
  process.exit(2);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`출시 점검이 ${signal} 신호로 종료되었습니다.`);
    process.exit(2);
  }
  process.exit(code ?? 2);
});
