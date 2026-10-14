import type { EndpointValidator } from "@mit-sdg/sync-engine/boundary";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function input(keys: string[], accepts: (value: Record<string, unknown>) => boolean): EndpointValidator {
  return value => record(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key)) && accepts(value)
    ? { ok: true } : { ok: false, detail: "Check the required fields and try again." };
}
const session = (value: unknown) => value === null || typeof value === "string" && value.length <= 128;
export const emptyInput = input([], () => true);
export const credentialsInput = input(["username", "password"], value =>
  typeof value.username === "string" && value.username.length <= 32 &&
  typeof value.password === "string" && value.password.length <= 128);
export const sessionInput = input(["session"], value => session(value.session));
export const createCardInput = input(["session", "label", "urls", "pageTypes"], value =>
  session(value.session) && typeof value.label === "string" && value.label.length <= 80 &&
  Array.isArray(value.urls) && value.urls.length <= 5 && value.urls.every(url => typeof url === "string" && url.length <= 2048) &&
  Array.isArray(value.pageTypes) && value.pageTypes.length <= 5 && value.pageTypes.every(type => typeof type === "string" && type.length <= 32));
export const getCardInput = input(["session", "card"], value =>
  session(value.session) && typeof value.card === "string" && value.card.length > 0 && value.card.length <= 128);
const identity = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 128;
export const inviteInput = getCardInput;
export const joinInput = input(["session", "invitation"], value => session(value.session) &&
  typeof value.invitation === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.invitation));
export const exchangeInput = input(["session", "exchange"], value => session(value.session) && identity(value.exchange));
export const approveInput = input(["session", "exchange", "revision"], value => session(value.session) &&
  identity(value.exchange) && Number.isSafeInteger(value.revision) && Number(value.revision) > 0);
export const reportInput = input(["session", "report"], value => session(value.session) && identity(value.report));
export const offerInput = input(["session", "exchange", "card", "revision"], value => session(value.session) &&
  identity(value.exchange) && identity(value.card) && Number.isSafeInteger(value.revision) && Number(value.revision) > 0);
export const workerFailureInput = input(["report"], value => identity(value.report));
export const workerRecoveryInput = input(["exchange"], value => identity(value.exchange));
export const workerResultInput = input(["report", "sourceData", "findingData"], value => identity(value.report) &&
  Array.isArray(value.sourceData) && value.sourceData.length >= 1 && value.sourceData.length <= 5 &&
  value.sourceData.every(record) && Array.isArray(value.findingData) && value.findingData.length <= 20 && value.findingData.every(record));
