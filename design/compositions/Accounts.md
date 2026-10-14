# Accounts

`UI` denotes requests and responses. In authenticated rules, `user`, `owner`, or `viewer` comes from `Sessioning.current(session)`, never client input. `: (...)` names successful outputs; chained steps stay in the same request flow.

[Register](reaction:Accounts.Register) creates an account; [sign in](reaction:Accounts.SignIn) starts a session; [current account](reaction:Accounts.Current) resolves it; [sign out](reaction:Accounts.SignOut) ends it.

```text
when UI.register (username, password)
then Authenticating.register (username, password)

when UI.signIn (username, password)
then Authenticating.authenticate (username, password)

when Authenticating.authenticate (username, password): (user) for a sign-in request
then Sessioning.start (user)

when UI.current (session)
then Sessioning.current (session)

when Sessioning.current (session): (user) for a current-account request
where Authenticating: user has username
then UI.respond (user, username)

when Sessioning.current (session): (user) for a current-account request
where Authenticating: user does not exist
then UI.respond (error: UNKNOWN_SESSION)

when UI.signOut (session)
then Sessioning.end (session)
```

Registration returns user; sign-in returns user with an HttpOnly session cookie; sign-out returns ended. Concept refusals become error responses.

```endpoints
Accounts.Register at /auth/register
Accounts.SignIn at /auth/sign-in
Accounts.Current at /auth/current
Accounts.SignOut at /auth/sign-out
```
