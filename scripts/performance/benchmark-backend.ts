import "../acceptance/load-environment";

import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { parseDatabaseEnv } from "../../src/shared/config/env";
import { exportMindmapForUser } from "../../src/server/domain/mindmap-export.service";
import { toMindmapDetailDTO } from "../../src/server/domain/mindmap.dto";
import { getMindmapDetailForUser } from "../../src/server/domain/mindmap.service";
import {
  deleteNodeSubtreeForUser,
  updateNodeContentForUser,
} from "../../src/server/domain/node.service";
import {
  createDeletionFixture,
  PERFORMANCE_MAPS,
  PERFORMANCE_USER_ID,
  seedPerformanceFixtures,
} from "./fixture";

const databaseUrl = parseDatabaseEnv().DATABASE_URL;
const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
const client = new PrismaClient({
  adapter,
  log: [{ level: "query", emit: "event" }],
});
let activeQueryCount = 0;
let collectingQueries = false;
client.$on("query", () => {
  if (collectingQueries) activeQueryCount += 1;
});

type Sample = Readonly<{ durationMs: number; queryCount: number; heapDeltaBytes: number; bytes: number }>;

try {
  await seedPerformanceFixtures(client);
  const detail100 = await benchmark("detail-100", 10, async () => {
    const detail = await getMindmapDetailForUser(PERFORMANCE_MAPS.hundred.id, PERFORMANCE_USER_ID, client);
    return Buffer.byteLength(JSON.stringify(toMindmapDetailDTO(detail)));
  });
  const detail1000 = await benchmark("detail-1000", 10, async () => {
    const detail = await getMindmapDetailForUser(PERFORMANCE_MAPS.expanded.id, PERFORMANCE_USER_ID, client);
    return Buffer.byteLength(JSON.stringify(toMindmapDetailDTO(detail)));
  });
  const export100 = await benchmark("export-100", 10, async () => {
    const result = await exportMindmapForUser(
      PERFORMANCE_MAPS.hundred.id,
      PERFORMANCE_USER_ID,
      { scope: "ALL", format: "MARKDOWN" },
      client,
    );
    return Buffer.byteLength(result.markdown);
  });
  const export1000 = await benchmark("export-1000", 10, async () => {
    const result = await exportMindmapForUser(
      PERFORMANCE_MAPS.expanded.id,
      PERFORMANCE_USER_ID,
      { scope: "ALL", format: "MARKDOWN" },
      client,
    );
    return Buffer.byteLength(result.markdown);
  });

  const autosaveNode = await client.node.findFirstOrThrow({
    where: { mindmapId: PERFORMANCE_MAPS.expanded.id },
    orderBy: { createdAt: "desc" },
  });
  let revision = autosaveNode.revision;
  const autosave1000 = await benchmark("autosave-1000", 10, async (sample) => {
    const updated = await updateNodeContentForUser(
      autosaveNode.id,
      PERFORMANCE_USER_ID,
      `# measured autosave ${sample}`,
      revision,
      client,
    );
    revision = updated.revision;
    return Buffer.byteLength(updated.contentMd);
  });

  const deletionSamples: Sample[] = [];
  for (let sample = 1; sample <= 3; sample += 1) {
    const fixture = await createDeletionFixture(client, sample);
    deletionSamples.push(await measure(async () => {
      const result = await deleteNodeSubtreeForUser(
        fixture.subtreeRootId,
        PERFORMANCE_USER_ID,
        1_000,
        client,
      );
      return Buffer.byteLength(JSON.stringify(result));
    }));
    await client.mindmap.delete({ where: { id: fixture.mindmapId } });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    database: { host: new URL(databaseUrl).hostname, version: await databaseVersion() },
    fixtures: { branchingFactor: 4, markdownBytesPerNode: 1_024 },
    results: {
      detail100: summarize(detail100),
      detail1000: summarize(detail1000),
      export100: summarize(export100),
      export1000: summarize(export1000),
      autosave1000: summarize(autosave1000),
      deleteSubtree1000: summarize(deletionSamples),
    },
    nPlusOne: {
      detail: maxQueries(detail1000) <= maxQueries(detail100) + 2,
      export: maxQueries(export1000) <= maxQueries(export100) + 2,
    },
  };
  await mkdir("artifacts/performance", { recursive: true });
  await writeFile("artifacts/performance/backend.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.nPlusOne.detail || !report.nPlusOne.export) process.exitCode = 1;
} finally {
  await client.$disconnect();
}

async function benchmark(
  name: string,
  count: number,
  operation: (sample: number) => Promise<number>,
): Promise<Sample[]> {
  await operation(0);
  const samples: Sample[] = [];
  for (let sample = 1; sample <= count; sample += 1) samples.push(await measure(() => operation(sample)));
  console.log(`[performance] ${name}: ${samples.length} measured samples.`);
  return samples;
}

async function measure(operation: () => Promise<number>): Promise<Sample> {
  activeQueryCount = 0;
  collectingQueries = true;
  const heapBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();
  try {
    const bytes = await operation();
    return {
      durationMs: round(performance.now() - startedAt),
      queryCount: activeQueryCount,
      heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
      bytes,
    };
  } finally {
    collectingQueries = false;
  }
}

function summarize(samples: readonly Sample[]) {
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  return {
    samples: samples.length,
    medianMs: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: Math.max(...durations),
    queryCountMin: Math.min(...samples.map((sample) => sample.queryCount)),
    queryCountMax: maxQueries(samples),
    responseBytes: Math.max(...samples.map((sample) => sample.bytes)),
    heapDeltaBytesMax: Math.max(...samples.map((sample) => sample.heapDeltaBytes)),
  };
}

function percentile(sorted: readonly number[], ratio: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

function maxQueries(samples: readonly Sample[]): number {
  return Math.max(...samples.map((sample) => sample.queryCount));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function databaseVersion(): Promise<string> {
  const rows = await client.$queryRaw<Array<{ version: string }>>`SELECT version()`;
  return rows[0]?.version ?? "unknown";
}
