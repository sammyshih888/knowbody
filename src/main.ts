import { createRuntime } from "./runtime.ts";
import { client, db } from "./db.ts";

const runtime = createRuntime(db);
await runtime.start();
const server = Bun.serve({
  hostname: "127.0.0.1", port: Number(process.env.PORT ?? 3000),
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
