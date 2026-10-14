import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createLocalClient } from "@mit-sdg/sync-engine/client";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { assembleApplication } from "./assembly.ts";
import { policy } from "./http.ts";
import { collectSources } from "./research/pages.ts";
import type { Db } from "mongodb";
import type { KnowbodyWire } from "../generated/wire.ts";

export function createRuntime(database: Db, collect = collectSources) {
  const application = assembleApplication(database);
  const gateway = createGateway({ application });
  const worker = createLocalClient<KnowbodyWire>({ invoker: gateway });
  const handler = createHttpHandler({ application, gateway, policy, responseHeaders: { "X-Content-Type-Options": "nosniff" } });
  const publicPaths = new Set(Object.keys(application.publicInterface.routes)
    .filter(path => !path.startsWith("/_worker/")).map(path => `${policy.basePath ?? ""}${path}`));
  let tail: Promise<unknown> = Promise.resolve();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticking = false;
  const jobs = new Map<string, { controller: AbortController; done: Promise<void> }>();
  // One host owns API writes and publication. Fetching never holds this queue.
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(async () => { try { return await work(); } finally { await application.whenIdle(); } });
    tail = result.catch(() => {});
    return result;
  };
  async function readWork() {
    const outcome = await worker["/_worker/work"]({});
    if ("error" in outcome) throw new Error(`Source work refused: ${outcome.error}`);
    return outcome.work;
  }
  async function tick() {
    if (stopped || ticking) return;
    ticking = true;
    try {
      await exclusive(async () => {
        let work = await readWork();
        for (const { exchange } of work.recoveries) {
          const outcome = await worker["/_worker/recover"]({ exchange });
          if ("error" in outcome) throw new Error(`Source recovery refused: ${outcome.error}`);
        }
        if (work.recoveries.length) work = await readWork();
        const eligible = new Set(work.reports.map(report => report.report));
        for (const [report, job] of jobs) if (!eligible.has(report)) job.controller.abort();
        for (const pending of work.reports) {
          if (jobs.size >= 2) break;
          if (jobs.has(pending.report)) continue;
          const controller = new AbortController();
          const done = collect(pending.urls, controller.signal).then(result => exclusive(async () => {
            if (stopped) return;
            const outcome = await worker["/_worker/result"]({ report: pending.report, ...result });
            if ("error" in outcome) throw new Error(`Source result refused: ${outcome.error}`);
          })).catch(async error => {
            if (controller.signal.aborted || stopped) return;
            console.error("Source brief failed:", error instanceof Error ? error.message : "unknown failure");
            await exclusive(async () => {
              if (stopped) return;
              const outcome = await worker["/_worker/failure"]({ report: pending.report });
              if ("error" in outcome) throw new Error(`Source failure refused: ${outcome.error}`);
            });
          }).finally(() => jobs.delete(pending.report));
          jobs.set(pending.report, { controller, done });
        }
      });
    } finally { ticking = false; }
  }
  return {
    application, gateway,
    async handle(request: Request) {
      // Accept only canonical public paths, including before the adapter decodes URLs.
      // Internal worker boundaries must stay unreachable even with a valid user cookie.
      if (!publicPaths.has(new URL(request.url).pathname))
        return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      const response = await exclusive(() => handler(request));
      response.headers.set("Cache-Control", "no-store");
      return response;
    },
    async start() {
      await tick();
      timer = setInterval(() => { void tick().catch(error => console.error("Brief recovery failed:", error)); }, 1000);
    },
    tick,
    async idle() { await tail; await Promise.all([...jobs.values()].map(job => job.done)); await tail; },
    async stop() {
      stopped = true;
      clearInterval(timer);
      for (const job of jobs.values()) job.controller.abort();
      await Promise.all([...jobs.values()].map(job => job.done));
      await tail;
      await gateway.beginDrain();
    },
  };
}
