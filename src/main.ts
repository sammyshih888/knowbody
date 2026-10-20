import { createRuntime } from "./runtime.ts";
import { client, db } from "./db.ts";

const runtime = createRuntime(db);
await runtime.start();
const dist = `${import.meta.dir}/../dist`;
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1", port: Number(process.env.PORT ?? 3000),
  routes: {
    "/api/*": request => runtime.handle(request),
    "/health": async () => {
      try {
        await db.command({ ping: 1 });
        return Response.json({ status: "ok" });
      } catch {
        return Response.json({ status: "unavailable" }, { status: 503 });
      }
    },
  },
  async fetch(request) {
    const file = Bun.file(dist + new URL(request.url).pathname);
    return new Response((await file.exists()) ? file : Bun.file(`${dist}/index.html`));
  },
});
console.log(`Knowbody backend: ${server.url}`);

async function shutdown() {
  await server.stop(true);
  await runtime.stop();
  await client.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
