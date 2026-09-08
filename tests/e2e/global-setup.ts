import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

export default function globalSetup() {
  if (!process.env.DATABASE_URL && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const command =
    process.platform === "win32"
      ? [
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npm.cmd run db:migrate"],
        ]
      : ["npm", ["run", "db:migrate"]];
  execFileSync(command[0] as string, command[1] as string[], {
    env: process.env,
    stdio: "inherit",
  });
  const resetCommand =
    process.platform === "win32"
      ? [
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", "npm.cmd run db:demo:reset"],
        ]
      : ["npm", ["run", "db:demo:reset"]];
  execFileSync(resetCommand[0] as string, resetCommand[1] as string[], {
    env: process.env,
    stdio: "inherit",
  });
}
