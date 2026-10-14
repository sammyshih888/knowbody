import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

export const policy = httpPolicy({
  publicOrigin: process.env.PUBLIC_ORIGIN ?? "http://localhost:5173",
  basePath: "/api",
  limits: { requestBodyBytes: 16384 },
  publicErrors: {
    INVALID_REGISTRATION: "INVALID_REQUEST", USERNAME_TAKEN: "CONFLICT",
    INVALID_CREDENTIALS: "UNAUTHORIZED", UNKNOWN_SESSION: "UNAUTHORIZED",
    INVALID_CARD: "INVALID_REQUEST", CARD_NOT_OWNED: "FORBIDDEN", CARD_UNAVAILABLE: "NOT_FOUND",
    ITEM_REGISTERED: "CONFLICT", NOT_ITEM_OWNER: "FORBIDDEN",
    INVALID_INVITATION: "INVALID_REQUEST", INVITATION_UNAVAILABLE: "CONFLICT",
    OFFER_UNAVAILABLE: "CONFLICT", APPROVAL_UNAVAILABLE: "CONFLICT", END_UNAVAILABLE: "CONFLICT",
    APPROVAL_NOT_READY: "CONFLICT", REPORT_UNAVAILABLE: "NOT_FOUND",
    INVALID_RESEARCH: "CONFLICT", INVALID_RESEARCH_RESULT: "INVALID_REQUEST",
  },
  cookies: { session: {
    name: "knowbody-session", input: "session",
    issue: [{ path: "/auth/sign-in", value: "session", expires: "expiresAt" }],
    clear: ["/auth/sign-out"],
  } },
});
