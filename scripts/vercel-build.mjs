import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["exec", "auth", "migrate", "--config", "./src/lib/auth.ts", "--yes"]);
run("node", ["./scripts/ensure-app-schema.mjs"]);

if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
  if (!process.env.LINGUAPLAY_OWNER_EMAIL || process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase() !== process.env.LINGUAPLAY_OWNER_EMAIL.trim().toLowerCase()) {
    throw new Error("INITIAL_ADMIN_EMAIL must match LINGUAPLAY_OWNER_EMAIL so a Better Auth administrator cannot be created outside the owner mapping.");
  }
  run("pnpm", [
    "exec",
    "auth",
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
  run("node", ["./scripts/ensure-app-schema.mjs"]);
}

run("pnpm", ["run", "build"]);
