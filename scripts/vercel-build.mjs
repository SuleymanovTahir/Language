import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["--yes", "auth@latest", "migrate", "--config", "./src/lib/auth.ts", "--yes"]);
run("node", ["./scripts/ensure-app-schema.mjs"]);

if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
  run("npx", [
    "--yes",
    "auth@latest",
    "create-admin",
    "--email",
    process.env.INITIAL_ADMIN_EMAIL,
    "--name",
    process.env.INITIAL_ADMIN_NAME || "Admin",
    "--role",
    "admin",
    "--password",
    process.env.INITIAL_ADMIN_PASSWORD,
    "--config",
    "./src/lib/auth.ts",
    "--yes",
  ]);
}

run("npm", ["run", "build"]);
