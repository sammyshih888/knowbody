import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, where } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../concepts.ts";
import { searchInput } from "./validators.ts";
const { Sessioning } = concepts;

// The host uses this guard before calling the stateless search service.
const Authorize = endpoint("/_discovery/authorize", ({ session, user, query, trimmed }) =>
  receive({ session, query })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(where(compute(computations.trimQuery, { query }, trimmed))
      .then(respond({ user, query: trimmed }))),
  { input: { required: ["session", "query"] }, validators: { input: searchInput } });

export const composition = { Authorize };
