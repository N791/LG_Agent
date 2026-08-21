"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_perf_hooks_1 = require("node:perf_hooks");
const prisma = new client_1.PrismaClient();
const iterations = positiveInteger(process.env['AUTH_BENCHMARK_ITERATIONS'], 500);
const concurrency = positiveInteger(process.env['AUTH_BENCHMARK_CONCURRENCY'], 10);
const thresholds = {
    p95Ms: positiveNumber(process.env['AUTH_BENCHMARK_P95_MS'], 75),
    p99Ms: positiveNumber(process.env['AUTH_BENCHMARK_P99_MS'], 150),
    poolUtilization: positiveNumber(process.env['AUTH_BENCHMARK_POOL_UTILIZATION'], 0.8),
};
async function main() {
    const benchmarkUserId = process.env['AUTH_BENCHMARK_USER_ID'];
    const selected = benchmarkUserId
        ? await prisma.userRole.findFirst({
            where: { userId: benchmarkUserId },
            select: { userId: true, organizationId: true },
        })
        : await prisma.userRole.findFirst({
            select: { userId: true, organizationId: true },
        });
    if (!selected)
        throw new Error('Authorization benchmark requires at least one role assignment.');
    const durations = [];
    let peakConnections = 0;
    let stopSampling = false;
    const sampler = sampleConnections(() => stopSampling, (value) => {
        peakConnections = Math.max(peakConnections, value);
    });
    const startedAt = node_perf_hooks_1.performance.now();
    await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
        for (let index = worker; index < iterations; index += concurrency) {
            const queryStartedAt = node_perf_hooks_1.performance.now();
            await prisma.userRole.findMany({
                where: {
                    userId: selected.userId,
                    organizationId: selected.organizationId,
                    user: { organizationId: selected.organizationId },
                    OR: [
                        { role: { organizationId: null } },
                        { role: { organizationId: selected.organizationId } },
                    ],
                },
                select: {
                    role: {
                        select: {
                            permissions: {
                                select: { permission: { select: { key: true, deprecatedAt: true } } },
                            },
                        },
                    },
                },
            });
            durations.push(node_perf_hooks_1.performance.now() - queryStartedAt);
        }
    }));
    stopSampling = true;
    await sampler;
    const elapsedSeconds = (node_perf_hooks_1.performance.now() - startedAt) / 1000;
    durations.sort((a, b) => a - b);
    const maxConnections = await prisma.$queryRaw `
    SELECT setting::int AS max_connections
      FROM pg_settings
     WHERE name = 'max_connections'
  `;
    const poolUtilization = peakConnections / (maxConnections[0]?.max_connections ?? 1);
    const result = {
        mode: 'database-realtime',
        iterations,
        concurrency,
        latencyMs: {
            p50: percentile(durations, 0.5),
            p95: percentile(durations, 0.95),
            p99: percentile(durations, 0.99),
        },
        databaseQps: iterations / elapsedSeconds,
        connections: {
            peak: peakConnections,
            max: maxConnections[0]?.max_connections ?? null,
            utilization: poolUtilization,
        },
        thresholds,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.latencyMs.p95 > thresholds.p95Ms ||
        result.latencyMs.p99 > thresholds.p99Ms ||
        poolUtilization > thresholds.poolUtilization) {
        process.exitCode = 1;
    }
}
async function sampleConnections(stop, observe) {
    while (!stop()) {
        const rows = await prisma.$queryRaw `
      SELECT count(*)::int AS connections
        FROM pg_stat_activity
       WHERE datname = current_database()
    `;
        observe(rows[0]?.connections ?? 0);
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}
function percentile(values, fraction) {
    return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] ?? 0;
}
function positiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
main()
    .catch((error) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=benchmark-authorization.js.map