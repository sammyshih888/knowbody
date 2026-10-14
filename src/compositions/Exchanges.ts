import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { approveInput, exchangeInput, inviteInput, joinInput, offerInput, sessionInput } from "./validators.ts";
import { Brief, SharedOffer } from "./Briefing.ts";

const { Authenticating, Collecting, Exchanging, Sessioning, Sharing } = concepts;
const Offerable = view("(user) can offer (card)", ({ user, card }) => where(
  Collecting._offerPreview({ owner: user, card }).is({}),
  Sharing._readable({ viewer: user, item: card }).is({ allowed: true }),
)).holds();
const Partner = former("partner for (user) in (exchange)", ({ user, exchange }, { other, username }) => where(
  Exchanging._counterparty({ user, exchange }).is({ other }),
  Authenticating._get({ user: other }).is({ username }),
).form({ username })).optional();
const ExchangeList = former("exchanges for (user)", ({ user }, { exchange, summary }) =>
  form({ exchanges: each(Exchanging._byUser({ user }).is({ exchange, summary }))
    .form({ exchange, summary, partner: whether(Partner({ user, exchange })),
      ownBrief: whether(Brief({ owner: user, viewer: user, exchange })),
      shared: whether(SharedOffer({ viewer: user, exchange })) }) }));
const Approvable = view("(user) can approve (exchange) at (revision)", ({ user, exchange, revision }, _, { first, second, firstItem, secondItem }) =>
  where(Exchanging._approvalPair({ user, exchange, revision }).is({ first, second, firstItem, secondItem }),
    Offerable({ user: first, card: firstItem }), Offerable({ user: second, card: secondItem }))).holds();
const Approve = endpoint("/exchanges/approve", ({ session, user, exchange, revision, status }) =>
  receive({ session, exchange, revision }).then(Sessioning.current({ session }).responds({ subject: user }))
    .then(where(Approvable({ user, exchange, revision }))
      .then(Exchanging.approve({ user, exchange, revision }).responds({ status }))
      .then(respond({ exchange, status })).named("approved"),
      where(no(Approvable({ user, exchange, revision }))).then(respond({ error: "APPROVAL_NOT_READY" })).named("unavailable")),
  { input: { required: ["session", "exchange", "revision"] }, validators: { input: approveInput } });

const Invite = endpoint("/exchanges/invite", ({ session, user, card, preview, exchange, invitation }) =>
  receive({ session, card })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(
      where(Offerable({ user, card }), Collecting._offerPreview({ owner: user, card }).is({ preview }))
        .then(Exchanging.open({ first: user, item: card, preview }).responds({ exchange, invitation }))
        .then(respond({ exchange, invitation })).named("owned-card"),
      where(no(Offerable({ user, card }))).then(respond({ error: "CARD_UNAVAILABLE" })).named("unavailable-card"),
    ),
  { input: { required: ["session", "card"] }, validators: { input: inviteInput } });
const Join = endpoint("/exchanges/join", ({ session, user, invitation, exchange }) =>
  receive({ session, invitation })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(Exchanging.join({ user, invitation }).responds({ exchange }))
    .then(respond({ exchange })),
  { input: { required: ["session", "invitation"] }, validators: { input: joinInput } });
const Offer = endpoint("/exchanges/offer", ({ session, user, exchange, card, revision, preview, nextRevision }) =>
  receive({ session, exchange, card, revision })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(
      where(Offerable({ user, card }), Collecting._offerPreview({ owner: user, card }).is({ preview }))
        .then(Exchanging.offer({ user, exchange, item: card, preview, revision }).responds({ revision: nextRevision }))
        .then(respond({ exchange, revision: nextRevision })).named("owned-card"),
      where(no(Offerable({ user, card }))).then(respond({ error: "CARD_UNAVAILABLE" })).named("unavailable-card"),
    ),
  { input: { required: ["session", "exchange", "card", "revision"] }, validators: { input: offerInput } });
const List = endpoint("/exchanges/list", ({ session, user }) =>
  receive({ session })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(respond({ collection: ExchangeList({ user }) })),
  { input: { required: ["session"] }, validators: { input: sessionInput } });
const End = endpoint("/exchanges/end", ({ session, user, exchange }) =>
  receive({ session, exchange })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(Exchanging.end({ user, exchange }).responds({}))
    .afterFlowSettles().then(respond({ exchange })),
  { input: { required: ["session", "exchange"] }, validators: { input: exchangeInput } });

export const composition = { Offerable, Partner, ExchangeList, Approvable, Approve, Invite, Join, Offer, List, End };
