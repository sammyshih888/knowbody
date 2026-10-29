import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";
import { credentialsInput, sessionInput } from "./validators.ts";

const { Authenticating, Sessioning } = concepts;
const Register = endpoint("/auth/register", ({ username, password, user, session, expiresAt }) =>
  receive({ username, password })
    .then(Authenticating.register({ username, password }).responds({ user }))
    .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
    .then(respond({ user, session, expiresAt })),
  { input: { required: ["username", "password"] }, validators: { input: credentialsInput } });

const SignIn = endpoint("/auth/sign-in", ({ username, password, user, session, expiresAt }) =>
  receive({ username, password })
    .then(Authenticating.authenticate({ username, password }).responds({ user }))
    .then(Sessioning.start({ subject: user }).responds({ session, expiresAt }))
    .then(respond({ user, session, expiresAt })),
  { input: { required: ["username", "password"] }, validators: { input: credentialsInput } });

const Current = endpoint("/auth/current", ({ session, user, username }) =>
  receive({ session })
    .then(Sessioning.current({ session }).responds({ subject: user }))
    .then(
      where(Authenticating._get({ user }).is({ username })).then(respond({ user, username })).named("known-account"),
      where(no(Authenticating._get({ user }).is({}))).then(respond({ error: "UNKNOWN_SESSION" })).named("missing-account")),
  { input: { required: ["session"] }, validators: { input: sessionInput } });

const SignOut = endpoint("/auth/sign-out", ({ session, ended }) =>
  receive({ session }).then(Sessioning.end({ session }).responds({ ended })).then(respond({ ended })),
  { input: { required: ["session"] }, validators: { input: sessionInput } });

export const composition = { Register, SignIn, Current, SignOut };
