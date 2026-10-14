import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import authenticatingSpec from "@design/concepts/Authenticating.md" with { type: "text" };
import sessioningSpec from "@design/concepts/Sessioning.md" with { type: "text" };
import collectingSpec from "@design/concepts/Collecting.md" with { type: "text" };
import sharingSpec from "@design/concepts/Sharing.md" with { type: "text" };
import exchangingSpec from "@design/concepts/Exchanging.md" with { type: "text" };
import researchingSpec from "@design/concepts/Researching.md" with { type: "text" };
import { ResearchingConcept, InvalidResearch, InvalidResearchResult } from "./concepts/Researching.ts";
import { AuthenticatingConcept, InvalidRegistration, UsernameTaken, InvalidCredentials } from "./concepts/Authenticating.ts";
import { SessioningConcept, UnknownSession } from "./concepts/Sessioning.ts";
import { CollectingConcept, InvalidCard, CardNotOwned } from "./concepts/Collecting.ts";
import { SharingConcept, ItemRegistered, NotItemOwner } from "./concepts/Sharing.ts";
import { ExchangingConcept, InvalidInvitation, InvitationUnavailable, OfferUnavailable, ApprovalUnavailable, EndUnavailable } from "./concepts/Exchanging.ts";

export const applicationConceptSet = conceptSet({
  Researching: registerConcept({ class: ResearchingConcept, spec: researchingSpec, refusals: {
    INVALID_RESEARCH: InvalidResearch, INVALID_RESEARCH_RESULT: InvalidResearchResult,
  } }),
  Authenticating: registerConcept({ class: AuthenticatingConcept, spec: authenticatingSpec,
    refusals: { INVALID_REGISTRATION: InvalidRegistration, USERNAME_TAKEN: UsernameTaken, INVALID_CREDENTIALS: InvalidCredentials } }),
  Sessioning: registerConcept({ class: SessioningConcept, spec: sessioningSpec, refusals: { UNKNOWN_SESSION: UnknownSession } }),
  Collecting: registerConcept({ class: CollectingConcept, spec: collectingSpec, refusals: { INVALID_CARD: InvalidCard, CARD_NOT_OWNED: CardNotOwned } }),
  Sharing: registerConcept({ class: SharingConcept, spec: sharingSpec, refusals: { ITEM_REGISTERED: ItemRegistered, NOT_ITEM_OWNER: NotItemOwner } }),
  Exchanging: registerConcept({ class: ExchangingConcept, spec: exchangingSpec, refusals: {
    INVALID_INVITATION: InvalidInvitation, INVITATION_UNAVAILABLE: InvitationUnavailable,
    OFFER_UNAVAILABLE: OfferUnavailable, APPROVAL_UNAVAILABLE: ApprovalUnavailable, END_UNAVAILABLE: EndUnavailable,
  } }),
});
export const { concepts } = applicationConceptSet;
