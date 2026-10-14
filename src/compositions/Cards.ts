import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { Readable as AccessReadable } from "./Access.ts";
import { concepts } from "../concepts.ts";
import { createCardInput, getCardInput, sessionInput } from "./validators.ts";

const { Collecting, Sessioning, Sharing } = concepts;
const RegisterOwnership = reaction(({ owner, card }) =>
  when(Collecting.create({ owner }).responds({ card })).then(Sharing.register({ owner, item: card })));
const Readable = view("(viewer) can read card (item)", ({ viewer, item }) =>
  where(AccessReadable({ viewer, item }), Collecting._get({ card: item }).is({}))).holds();
const CardList = former("cards owned by (owner)", ({ owner }, { card, label, urls, pageTypes, archived }) =>
  form({ cards: each(
    Collecting._byOwner({ owner }).is({ card, label, urls, pageTypes, archived }),
  ).where(Readable({ viewer: owner, item: card })).form({ card, label, urls, pageTypes, archived }) }));
const CardDetails = former("details for (card)", ({ card }, { label, urls, pageTypes, archived }) =>
  where(Collecting._get({ card }).is({ label, urls, pageTypes, archived })).form({ card, label, urls, pageTypes, archived }));

const Create = endpoint("/cards/create", ({ session, owner, label, urls, pageTypes, card }) =>
  receive({ session, label, urls, pageTypes })
    .then(Sessioning.current({ session }).responds({ subject: owner }))
    .then(Collecting.create({ owner, label, urls, pageTypes }).responds({ card }))
    .afterFlowSettles()
    .then(
      where(Readable({ viewer: owner, item: card })).then(respond({ card })).named("registered"),
      where(no(Readable({ viewer: owner, item: card }))).then(respond({ error: "CARD_NOT_READY" })).named("unregistered")),
  { input: { required: ["session", "label", "urls", "pageTypes"] }, validators: { input: createCardInput } });
const List = endpoint("/cards/list", ({ session, owner }) =>
  receive({ session })
    .then(Sessioning.current({ session }).responds({ subject: owner }))
    .then(respond({ collection: CardList({ owner }) })),
  { input: { required: ["session"] }, validators: { input: sessionInput } });
const Get = endpoint("/cards/get", ({ session, viewer, card }) =>
  receive({ session, card })
    .then(Sessioning.current({ session }).responds({ subject: viewer }))
    .then(
      where(Readable({ viewer, item: card })).then(respond({ details: CardDetails({ card }) })).named("readable"),
      where(no(Readable({ viewer, item: card })))
        .then(respond({ error: "CARD_UNAVAILABLE" })).named("inaccessible"),
    ),
  { input: { required: ["session", "card"] }, validators: { input: getCardInput } });
export const composition = { RegisterOwnership, Readable, CardList, CardDetails, Create, List, Get };
