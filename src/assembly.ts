import { assemble } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { applicationConceptSet } from "./concepts.ts";
import { AuthenticatingConcept } from "./concepts/Authenticating.ts";
import { SessioningConcept } from "./concepts/Sessioning.ts";
import { CollectingConcept } from "./concepts/Collecting.ts";
import { SharingConcept } from "./concepts/Sharing.ts";
import { ExchangingConcept } from "./concepts/Exchanging.ts";
import { ResearchingConcept } from "./concepts/Researching.ts";
import { composition as Access } from "./compositions/Access.ts";
import { composition as Briefing } from "./compositions/Briefing.ts";
import { composition as Accounts } from "./compositions/Accounts.ts";
import { composition as Cards } from "./compositions/Cards.ts";
import { composition as Exchanges } from "./compositions/Exchanges.ts";
import { composition as Discovery } from "./compositions/Discovery.ts";
import { db } from "./db.ts";

export function assembleApplication(database: Db = db, clock?: () => Date) {
  return assemble({
    clock,
    conceptSet: applicationConceptSet,
    instances: {
      Authenticating: new AuthenticatingConcept(database),
      Sessioning: new SessioningConcept(database),
      Collecting: new CollectingConcept(database),
      Sharing: new SharingConcept(database),
      Exchanging: new ExchangingConcept(database),
      Researching: new ResearchingConcept(database),
    },
    composition: { Accounts, Cards, Exchanges, Access, Briefing, Discovery },
    queryCache: "none",
    executionLimits: { maxActiveRootFlows: 100, maxPendingRequests: 100, maxRowsPerEvaluation: 1000,
      maxRequestDurationMs: 10000, maxActionsPerFlow: 50, maxFiringsPerFlow: 50 },
    rawFaultReporter: ({ error }) => console.error("Application fault:", error),
  });
}
