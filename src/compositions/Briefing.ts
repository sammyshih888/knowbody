import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { each, form, former, no, reaction, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { Readable } from "./Access.ts";
import { emptyInput, reportInput, workerFailureInput, workerRecoveryInput, workerResultInput } from "./validators.ts";
const { Collecting, Exchanging, Researching, Sharing, Sessioning } = concepts;

const SynchronizeAfterApproval = reaction(({ exchange }) =>
  when(Exchanging.approve({}).responds({ exchange, status: "ACTIVE" }))
    .then(Exchanging.synchronize({ exchange })));
const Activate = reaction(({ exchange, owner, viewer, item }) =>
  when(Exchanging.synchronize({}).responds({ exchange, status: "ACTIVE" }))
    .where(Exchanging._offers({ exchange }).is({ owner, viewer, item }))
    .then(Sharing.grant({ owner, viewer, item, scope: exchange })));
const StartReports = reaction(({ exchange, owner, item, urls }) =>
  when(Exchanging.synchronize({}).responds({ exchange, status: "ACTIVE" }))
    .where(Exchanging._offers({ exchange }).is({ owner, item }), Collecting._get({ card: item }).is({ urls }))
    .then(Researching.start({ owner, context: exchange, urls })));
const RegisterReport = reaction(({ owner, report, context, viewer }) =>
  when(Researching.start({ owner, context }).responds({ report }))
    .then(Sharing.register({ owner, item: report }))
    .then(where(Exchanging._offers({ exchange: context }).is({ owner, viewer }))
      .then(Sharing.grant({ owner, viewer, item: report, scope: context }))));
const End = reaction(({ exchange }) =>
  when(Exchanging.end({}).responds({ exchange }))
    .then(Sharing.revoke({ scope: exchange })).then(Researching.cancelContext({ context: exchange })));
const RepairEnd = reaction(({ exchange }) =>
  when(Exchanging.synchronize({}).responds({ exchange, status: "ENDED" }))
    .then(Sharing.revoke({ scope: exchange })).then(Researching.cancelContext({ context: exchange })));

const Publishable = view("report (report) can accept a worker outcome", ({ report }, _, { exchange }) =>
  where(Researching._pendingReport({ report }).is({ context: exchange }),
    Exchanging._active({ exchange }).is({ active: true }))).holds();

const OfferComplete = view("offer (item) from (owner) to (viewer) in (exchange) has its sharing effects", ({ item, owner, viewer, exchange }, _, { report }) =>
  where(Sharing._scopes({ viewer, item }).is({ scope: exchange }),
    Researching._forOwner({ owner, context: exchange }).is({ report }),
    Sharing._scopes({ viewer, item: report }).is({ scope: exchange }))).holds();
const IncompleteOffer = view("(exchange) has an offer needing recovery", ({ exchange }, _, { owner, viewer, item }) =>
  where(Exchanging._offers({ exchange }).is({ owner, viewer, item }),
    no(OfferComplete({ item, owner, viewer, exchange })))).holds();
const LifecycleComplete = view("(exchange) has its lifecycle effects", ({ exchange }) => [
  where(Exchanging._active({ exchange }).is({ active: true }), Exchanging._offers({ exchange }).is({}),
    no(IncompleteOffer({ exchange }))),
  where(Exchanging._active({ exchange }).is({ active: false }),
    Sharing._revoked({ scope: exchange }).is({ revoked: true }),
    Researching._cancelled({ context: exchange }).is({ cancelled: true })),
]).holds();
const Work = former("source brief work", ({}, { exchange, report, urls }) => form({
  recoveries: each(Exchanging._lifecycle({}).is({ exchange }))
    .where(no(LifecycleComplete({ exchange }))).form({ exchange }),
  reports: each(Researching._pending({}).is({ report, urls }))
    .where(Publishable({ report })).form({ report, urls }),
}));

// These boundaries are invoked by the host worker only, never exposed over HTTP.
const WorkerWork = endpoint("/_worker/work", () =>
  receive({}).then(respond({ work: Work({}) })),
  { input: { required: [] }, validators: { input: emptyInput } });
const WorkerRecover = endpoint("/_worker/recover", ({ exchange }) =>
  receive({ exchange }).then(Exchanging.synchronize({ exchange }).responds({}))
    .afterFlowSettles().then(respond({ exchange })),
  { input: { required: ["exchange"] }, validators: { input: workerRecoveryInput } });
const WorkerResult = endpoint("/_worker/result", ({ report, sourceData, findingData, stored }) =>
  receive({ report, sourceData, findingData }).then(
    where(Publishable({ report }))
      .then(Researching.finish({ report, sourceData, findingData }).responds({ stored }))
      .then(respond({ stored })).named("publish"),
    where(no(Publishable({ report }))).then(respond({ stored: false })).named("ignore")),
  { input: { required: ["report", "sourceData", "findingData"] }, validators: { input: workerResultInput } });
const WorkerFailure = endpoint("/_worker/failure", ({ report, stored }) =>
  receive({ report }).then(
    where(Publishable({ report })).then(Researching.fail({ report }).responds({ stored }))
      .then(respond({ stored })).named("fail"),
    where(no(Publishable({ report }))).then(respond({ stored: false })).named("ignore")),
  { input: { required: ["report"] }, validators: { input: workerFailureInput } });

export const Brief = former("brief owned by (owner) in (exchange) for (viewer)", ({ owner, exchange, viewer }, { report, details }) =>
  where(Researching._forOwner({ owner, context: exchange }).is({ report }), Readable({ viewer, item: report }),
    Researching._get({ report }).is({ details })).form({ report, details })).optional();
export const SharedOffer = former("shared offer for (viewer) in (exchange)", ({ viewer, exchange }, { owner, card, label, urls, pageTypes }) =>
  where(Exchanging._otherOffer({ user: viewer, exchange }).is({ owner, card }), Readable({ viewer, item: card }),
    Collecting._get({ card }).is({ label, urls, pageTypes }))
    .form({ card, label, urls, pageTypes, brief: whether(Brief({ owner, exchange, viewer })) })).optional();
const Details = former("report details for (report)", ({ report }, { details }) =>
  where(Researching._get({ report }).is({ details })).form({ details }));
const ReadableReport = view("(viewer) can read report (report)", ({ viewer, report }) =>
  where(Readable({ viewer, item: report }), Researching._get({ report }).is({}))).holds();
const Get = endpoint("/reports/get", ({ session, viewer, report }) =>
  receive({ session, report }).then(Sessioning.current({ session }).responds({ subject: viewer }))
    .then(where(ReadableReport({ viewer, report })).then(respond({ report: Details({ report }) })).named("readable"),
      where(no(ReadableReport({ viewer, report }))).then(respond({ error: "REPORT_UNAVAILABLE" })).named("unavailable")),
  { input: { required: ["session", "report"] }, validators: { input: reportInput } });
export const composition = {
  SynchronizeAfterApproval, Activate, StartReports, RegisterReport, End, RepairEnd,
  Publishable, OfferComplete, IncompleteOffer, LifecycleComplete, Work, WorkerWork, WorkerRecover, WorkerResult, WorkerFailure,
  Brief, SharedOffer, Details, ReadableReport, Get,
};
