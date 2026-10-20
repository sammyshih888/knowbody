import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { KnowbodyWireHttp } from "../generated/wire.ts";

export const api = createHttpClient<Omit<KnowbodyWireHttp, `/_worker/${string}` | `/_discovery/${string}`>>({ baseUrl: "/api" });
export type Card = KnowbodyWireHttp["/cards/list"]["output"]["collection"]["cards"][number];
export type Exchange = KnowbodyWireHttp["/exchanges/list"]["output"]["collection"]["exchanges"][number];
