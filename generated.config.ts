import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { policy } from "./src/http.ts";

export default {
  assemble: () => assembleApplication(),
  title: "Knowbody",
  wireName: "KnowbodyWire",
  design: { version: 1, documents: [
    new URL("./design/types.md", import.meta.url),
    new URL("./design/compositions/Accounts.md", import.meta.url),
    new URL("./design/compositions/Cards.md", import.meta.url),
    new URL("./design/compositions/Exchanges.md", import.meta.url),
    new URL("./design/compositions/Access.md", import.meta.url),
    new URL("./design/compositions/Briefing.md", import.meta.url),
  ] },
  projections: [httpWire({ policy, name: "KnowbodyWireHttp" })],
};
