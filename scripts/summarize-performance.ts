import { readFile } from "node:fs/promises";
import {
  summarizeOperations,
  type MeasuredOperation,
} from "../src/server/performance/statistics";

type TelemetryEvent = MeasuredOperation & {
  event: "nexus.performance";
  outcome: "success" | "error";
};

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error(
      "Usage: npm run performance:summarize -- <telemetry.ndjson>",
    );
  }

  const content = await readFile(inputPath, "utf8");
  const measurements = content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelemetryEvent)
    .filter(
      (event) =>
        event.event === "nexus.performance" && event.outcome === "success",
    );

  console.table(summarizeOperations(measurements));
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unable to summarize telemetry.",
  );
  process.exitCode = 1;
});
