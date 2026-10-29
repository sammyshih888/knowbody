<!-- Generated from the Knowbody assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Knowbody — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (user: User)`
  - Refuses `INVALID_REGISTRATION`: Use a username of 1 to 32 letters, numbers, underscores, or hyphens and a password of 1 to 128 characters.
  - Refuses `USERNAME_TAKEN`: That username is already registered.
- `authenticate(username: String, password: String) : returns (user: User)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_get(user: User) : optional (username: String)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [Knowbody application types](../design/types.md), line 11.

### Collecting

Defined in [Collecting](../design/concepts/Collecting.md), line 1.

#### Actions

- `create(owner: User, label: String, urls: UrlSelection, pageTypes?: PageTypes) : returns (card: Card)`
  - Refuses `INVALID_CARD`: Add a label and one to five distinct public HTTPS page URLs.
- `archive(owner: User, card: Card) : returns (card: Card)`
  - Refuses `CARD_NOT_OWNED`: This card is not available to you.

#### Queries

- `_get(card: Card) : optional (owner: User, label: String, urls: UrlSelection, pageTypes: PageTypes, archived: Flag)`
- `_byOwner(owner: User) : many (card: Card, label: String, urls: UrlSelection, pageTypes: PageTypes, archived: Flag)`
- `_offerPreview(owner: User, card: Card) : optional (preview: String)`

#### Instances

- `Collecting` — instance of `Collecting` — [Knowbody application types](../design/types.md), line 16.
  - `User` is `Authenticating.User` — [Knowbody application types](../design/types.md), line 17.

### Exchanging

Defined in [Exchanging](../design/concepts/Exchanging.md), line 1.

#### Actions

- `open(first: User, item: Item, preview: String, now: Date) : returns (exchange: Exchange, invitation: String)`
  - Refuses `INVALID_INVITATION`: Choose an item with a short preview and a valid current time.
- `join(user: User, invitation: String, now: Date) : returns (exchange: Exchange)`
  - Refuses `INVITATION_UNAVAILABLE`: This invitation cannot be joined. It may be expired, claimed, or ended.
- `offer(user: User, exchange: Exchange, item: Item, preview: String, revision: Number) : returns (exchange: Exchange, revision: Number)`
  - Refuses `OFFER_UNAVAILABLE`: The offer could not be changed. Reload the current exchange and try again.
- `approve(user: User, exchange: Exchange, revision: Number) : returns (exchange: Exchange, status: Status)`
  - Refuses `APPROVAL_UNAVAILABLE`: The exchange cannot be approved at this revision.
- `end(user: User, exchange: Exchange) : returns (exchange: Exchange)`
  - Refuses `END_UNAVAILABLE`: This exchange cannot be ended by this account.
- `synchronize(exchange: Exchange) : returns (exchange: Exchange, status: Status | null)`

#### Queries

- `_byUser(user: User, now: Date) : many (exchange: Exchange, summary: ExchangeSummary)`
- `_counterparty(user: User, exchange: Exchange) : optional (other: User)`
- `_inviter(user: User, invitation: String, now: Date) : optional (inviter: User)`
- `_lifecycle() : many (exchange: Exchange, status: Status)`
- `_active(exchange: Exchange) : one (active: Flag)`
- `_participant(user: User, exchange: Exchange) : one (participant: Flag)`
- `_approvalPair(user: User, exchange: Exchange, revision: Number) : optional (first: User, second: User, firstItem: Item, secondItem: Item)`
- `_offers(exchange: Exchange) : many (owner: User, viewer: User, item: Item)`
- `_otherOffer(user: User, exchange: Exchange) : optional (owner: User, card: Item)`

#### Instances

- `Exchanging` — instance of `Exchanging` — [Knowbody application types](../design/types.md), line 28.
  - `Item` is `Collecting.Card` — [Knowbody application types](../design/types.md), line 30.
  - `User` is `Authenticating.User` — [Knowbody application types](../design/types.md), line 29.

### Researching

Defined in [Researching](../design/concepts/Researching.md), line 1.

#### Actions

- `start(owner: User, context: Context, urls: URLs) : returns (report: Report)`
  - Refuses `INVALID_RESEARCH`: Research requires a fixed selection of one to five HTTPS URLs in an open context.
- `finish(report: Report, sourceData: SourceDataSet, findingData: FindingDataSet) : returns (stored: Flag)`
  - Refuses `INVALID_RESEARCH_RESULT`: Results must describe exactly the saved sources and supported comparisons between them.
- `fail(report: Report) : returns (stored: Flag)`
- `cancel(report: Report) : returns ()`
- `cancelContext(context: Context) : returns ()`

#### Queries

- `_get(report: Report) : optional (details: ReportDetails)`
- `_forOwner(owner: User, context: Context) : optional (report: Report)`
- `_pending() : many (report: Report, context: Context, urls: URLs)`
- `_pendingReport(report: Report) : optional (context: Context)`
- `_cancelled(context: Context) : one (cancelled: Flag)`

#### Instances

- `Researching` — instance of `Researching` — [Knowbody application types](../design/types.md), line 24.
  - `Context` is `Exchanging.Exchange` — [Knowbody application types](../design/types.md), line 26.
  - `User` is `Authenticating.User` — [Knowbody application types](../design/types.md), line 25.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session | null) : returns (subject: Subject)`
  - Refuses `UNKNOWN_SESSION`: Please sign in to continue.
- `end(session: Session | null) : returns (ended: Flag)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [Knowbody application types](../design/types.md), line 13.
  - `Subject` is `Authenticating.User` — [Knowbody application types](../design/types.md), line 14.

### Sharing

Defined in [Sharing](../design/concepts/Sharing.md), line 1.

#### Actions

- `register(owner: User, item: Item) : returns ()`
  - Refuses `ITEM_REGISTERED`: This item already has another owner.
- `grant(owner: User, viewer: User, item: Item, scope: Scope) : returns ()`
  - Refuses `NOT_ITEM_OWNER`: Only the owner can grant access.
- `revoke(scope: Scope) : returns ()`

#### Queries

- `_readable(viewer: User, item: Item) : one (allowed: Flag)`
- `_owned(viewer: User, item: Item) : one (owned: Flag)`
- `_scopes(viewer: User, item: Item) : many (scope: Scope)`
- `_revoked(scope: Scope) : one (revoked: Flag)`

#### Instances

- `Sharing` — instance of `Sharing` — [Knowbody application types](../design/types.md), line 19.
  - `Item` is `SharedItem` — [Knowbody application types](../design/types.md), line 21.
  - `Scope` is `Exchanging.Exchange` — [Knowbody application types](../design/types.md), line 22.
  - `User` is `Authenticating.User` — [Knowbody application types](../design/types.md), line 20.

## Application types

Concrete types:

- `SharedItem` — [Knowbody application types](../design/types.md), line 6.

## Computations

- `trimQuery(query: String) : String` — [Private cards](../design/compositions/Cards.md), line 14.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### offer (item) from (owner) to (viewer) in (exchange) has its sharing effects

Authored path: `Briefing.OfferComplete`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 56.

```view
offer (item) from (owner) to (viewer) in (exchange) has its sharing effects — inputs (item, owner, viewer, exchange); outputs (); bindings (report)
  where
    Sharing._scopes (item, viewer) has (scope: exchange)
    Researching._forOwner (context: exchange, owner) has (report)
    Sharing._scopes (item: report, viewer) has (scope: exchange)
```

### (exchange) has an offer needing recovery

Authored path: `Briefing.IncompleteOffer`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 56.

```view
(exchange) has an offer needing recovery — inputs (exchange); outputs (); bindings (owner, viewer, item)
  where
    Exchanging._offers (exchange) has (item, owner, viewer)
    no view "offer (item) from (owner) to (viewer) in (exchange) has its sharing effects" with (exchange, item, owner, viewer)
```

### (exchange) has its lifecycle effects

Authored path: `Briefing.LifecycleComplete`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 56.

```view
(exchange) has its lifecycle effects — inputs (exchange); outputs (); bindings ()
  where
    Exchanging._active (exchange) has (active: true)
    Exchanging._offers (exchange)
    no view "(exchange) has an offer needing recovery" with (exchange)
  where
    Exchanging._active (exchange) has (active: false)
    Sharing._revoked (scope: exchange) has (revoked: true)
    Researching._cancelled (context: exchange) has (cancelled: true)
```

### (user) can offer (card)

Authored path: `Exchanges.Offerable`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.

```view
(user) can offer (card) — inputs (user, card); outputs (); bindings ()
  where
    Collecting._offerPreview (card, owner: user)
    Sharing._readable (item: card, viewer: user) has (allowed: true)
```

### (user) can approve (exchange) at (revision)

Authored path: `Exchanges.Approvable`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.

```view
(user) can approve (exchange) at (revision) — inputs (user, exchange, revision); outputs (); bindings (first, second, firstItem, secondItem)
  where
    Exchanging._approvalPair (exchange, revision, user) has (first, firstItem, second, secondItem)
    view "(user) can offer (card)" with (card: firstItem, user: first)
    view "(user) can offer (card)" with (card: secondItem, user: second)
```

### (viewer) can read (item)

Authored path: `Access.Readable`.
- Covered by [Reading shared material](../design/compositions/Access.md), line 3.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.

```view
(viewer) can read (item) — inputs (viewer, item); outputs (); bindings (scope)
  where Sharing._owned (item, viewer) has (owned: true)
  where
    Sharing._scopes (item, viewer) has (scope)
    Exchanging._active (exchange: scope) has (active: true)
```

### (viewer) can read card (item)

Authored path: `Cards.Readable`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.

```view
(viewer) can read card (item) — inputs (viewer, item); outputs (); bindings ()
  where
    view "(viewer) can read (item)" with (item, viewer)
    Collecting._get (card: item)
```

### (viewer) can read report (report)

Authored path: `Briefing.ReadableReport`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.

```view
(viewer) can read report (report) — inputs (viewer, report); outputs (); bindings ()
  where
    view "(viewer) can read (item)" with (item: report, viewer)
    Researching._get (report)
```

### report (report) can accept a worker outcome

Authored path: `Briefing.Publishable`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 54.

```view
report (report) can accept a worker outcome — inputs (report); outputs (); bindings (exchange)
  where
    Researching._pendingReport (report) has (context: exchange)
    Exchanging._active (exchange) has (active: true)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### brief owned by (owner) in (exchange) for (viewer)

Authored path: `Briefing.Brief`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.

```former
Former "brief owned by (owner) in (exchange) for (viewer)" — inputs (owner, exchange, viewer); bindings (report, details); promises at most one record — forms:
  a record of
    where Researching._forOwner (context: exchange, owner) has (report)
    where view "(viewer) can read (item)" with (item: report, viewer)
    where Researching._get (report) has (details)
    details
    report
```

### cards owned by (owner)

Authored path: `Cards.CardList`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.

```former
Former "cards owned by (owner)" — inputs (owner); bindings (card, label, urls, pageTypes, archived); promises exactly one record — forms:
  a record of
    cards: each Collecting._byOwner (owner) has (archived, card, label, pageTypes, urls)
      where view "(viewer) can read card (item)" with (item: card, viewer: owner)
      form a record of
        archived
        card
        label
        pageTypes
        urls
```

### details for (card)

Authored path: `Cards.CardDetails`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.

```former
Former "details for (card)" — inputs (card); bindings (label, urls, pageTypes, archived); promises exactly one record — forms:
  a record of
    where Collecting._get (card) has (archived, label, pageTypes, urls)
    archived
    card
    label
    pageTypes
    urls
```

### partner for (user) in (exchange)

Authored path: `Exchanges.Partner`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.

```former
Former "partner for (user) in (exchange)" — inputs (user, exchange); bindings (other, username); promises at most one record — forms:
  a record of
    where Exchanging._counterparty (exchange, user) has (other)
    where Authenticating._get (user: other) has (username)
    username
```

### shared offer for (viewer) in (exchange)

Authored path: `Briefing.SharedOffer`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.

```former
Former "shared offer for (viewer) in (exchange)" — inputs (viewer, exchange); bindings (owner, card, label, urls, pageTypes); promises at most one record — forms:
  a record of
    where Exchanging._otherOffer (exchange, user: viewer) has (card, owner)
    where view "(viewer) can read (item)" with (item: card, viewer)
    where Collecting._get (card) has (label, pageTypes, urls)
    brief: whether former "brief owned by (owner) in (exchange) for (viewer)" with (exchange, owner, viewer)
    card
    label
    pageTypes
    urls
```

### exchanges for (user) at (instant)

Authored path: `Exchanges.ExchangeList`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.

```former
Former "exchanges for (user) at (instant)" — inputs (user, instant); bindings (exchange, summary); promises exactly one record — forms:
  a record of
    exchanges: each Exchanging._byUser (now: instant, user) has (exchange, summary)
      form a record of
        exchange
        ownBrief: whether former "brief owned by (owner) in (exchange) for (viewer)" with (exchange, owner: user, viewer: user)
        partner: whether former "partner for (user) in (exchange)" with (exchange, user)
        shared: whether former "shared offer for (viewer) in (exchange)" with (exchange, viewer: user)
        summary
```

### inviter of (invitation) for (user) at (instant)

Authored path: `Exchanges.InvitationSender`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 7.

```former
Former "inviter of (invitation) for (user) at (instant)" — inputs (invitation, user, instant); bindings (inviter, username); promises at most one record — forms:
  a record of
    where Exchanging._inviter (invitation, now: instant, user) has (inviter)
    where Authenticating._get (user: inviter) has (username)
    username
```

### report details for (report)

Authored path: `Briefing.Details`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.

```former
Former "report details for (report)" — inputs (report); bindings (details); promises exactly one record — forms:
  a record of
    where Researching._get (report) has (details)
    details
```

### source brief work

Authored path: `Briefing.Work`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 54.

```former
Former "source brief work" — inputs (); bindings (exchange, report, urls); promises exactly one record — forms:
  a record of
    recoveries: each Exchanging._lifecycle () has (exchange)
      where no view "(exchange) has its lifecycle effects" with (exchange)
      form a record of
        exchange
    reports: each Researching._pending () has (report, urls)
      where view "report (report) can accept a worker outcome" with (report)
      form a record of
        report
        urls
```

## Reactions

### Accounts.Current

Authored path: `Accounts.Current`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 40.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Accounts.Current:known-account#2

Authored path: `Accounts.Current`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 40.

```reaction
when Sessioning.current (session, subject: user), asked by Accounts.Current
where
  Authenticating._get (user) has (username)
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (requestId, user, username)
```

### Accounts.Current:missing-account#2

Authored path: `Accounts.Current`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 40.

```reaction
when Sessioning.current (session, subject: user), asked by Accounts.Current
where
  no Authenticating._get (user)
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (error: "UNKNOWN_SESSION", requestId)
```

### Accounts.Register

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 38.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.register (password, username)
```

### Accounts.Register#2

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 38.

```reaction
when Authenticating.register (password, username, user), asked by Accounts.Register
then
  Sessioning.start (subject: user)
```

### Accounts.Register#3

Authored path: `Accounts.Register`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 38.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Accounts.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Accounts.SignIn

Authored path: `Accounts.SignIn`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 39.

```reaction
when RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### Accounts.SignIn#2

Authored path: `Accounts.SignIn`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 39.

```reaction
when Authenticating.authenticate (password, username, user), asked by Accounts.SignIn
then
  Sessioning.start (subject: user)
```

### Accounts.SignIn#3

Authored path: `Accounts.SignIn`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 39.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Accounts.SignIn#2
where
  earlier, RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Accounts.SignOut

Authored path: `Accounts.SignOut`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 41.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### Accounts.SignOut#2

Authored path: `Accounts.SignOut`.
- Covered by [Accounts](../design/compositions/Accounts.md), line 5.
- Covered by [Accounts](../design/compositions/Accounts.md), line 41.

```reaction
when Sessioning.end (session, ended), asked by Accounts.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  RequestBoundary.respond (ended, requestId)
```

### Briefing.Activate

Authored path: `Briefing.Activate`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 3.

```reaction
when Exchanging.synchronize (exchange, status: "ACTIVE")
where
  Exchanging._offers (exchange) has (item, owner, viewer)
then
  Sharing.grant (item, owner, scope: exchange, viewer)
```

### Briefing.End

Authored path: `Briefing.End`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 28.

```reaction
when Exchanging.end (exchange)
then
  Sharing.revoke (scope: exchange)
```

### Briefing.End#2

Authored path: `Briefing.End`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 28.

```reaction
when Sharing.revoke (scope: exchange), asked by Briefing.End
then
  Researching.cancelContext (context: exchange)
```

### Briefing.Get

Authored path: `Briefing.Get`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 94.

```reaction
when RequestBoundary.request (path: "/reports/get", report, requestId, session)
then
  Sessioning.current (session)
```

### Briefing.Get:readable#2

Authored path: `Briefing.Get`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 94.

```reaction
when Sessioning.current (session, subject: viewer), asked by Briefing.Get
where
  earlier, RequestBoundary.request (path: "/reports/get", report, requestId, session)
  view "(viewer) can read report (report)" with (report, viewer)
then
  RequestBoundary.respond (report: former "report details for (report)" with (report), requestId)
```

### Briefing.Get:unavailable#2

Authored path: `Briefing.Get`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 41.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 94.

```reaction
when Sessioning.current (session, subject: viewer), asked by Briefing.Get
where
  earlier, RequestBoundary.request (path: "/reports/get", report, requestId, session)
  no view "(viewer) can read report (report)" with (report, viewer)
then
  RequestBoundary.respond (error: "REPORT_UNAVAILABLE", requestId)
```

### Briefing.RegisterReport

Authored path: `Briefing.RegisterReport`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 3.

```reaction
when Researching.start (context, owner, report)
then
  Sharing.register (item: report, owner)
```

### Briefing.RegisterReport#2

Authored path: `Briefing.RegisterReport`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 3.

```reaction
when Sharing.register (item: report, owner), asked by Briefing.RegisterReport
where
  earlier, Researching.start (context, owner, report)
  Exchanging._offers (exchange: context) has (owner, viewer)
then
  Sharing.grant (item: report, owner, scope: context, viewer)
```

### Briefing.RepairEnd

Authored path: `Briefing.RepairEnd`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 28.

```reaction
when Exchanging.synchronize (exchange, status: "ENDED")
then
  Sharing.revoke (scope: exchange)
```

### Briefing.RepairEnd#2

Authored path: `Briefing.RepairEnd`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 28.

```reaction
when Sharing.revoke (scope: exchange), asked by Briefing.RepairEnd
then
  Researching.cancelContext (context: exchange)
```

### Briefing.StartReports

Authored path: `Briefing.StartReports`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 3.

```reaction
when Exchanging.synchronize (exchange, status: "ACTIVE")
where
  Exchanging._offers (exchange) has (item, owner)
  Collecting._get (card: item) has (urls)
then
  Researching.start (context: exchange, owner, urls)
```

### Briefing.SynchronizeAfterApproval

Authored path: `Briefing.SynchronizeAfterApproval`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 3.

```reaction
when Exchanging.approve (exchange, status: "ACTIVE")
then
  Exchanging.synchronize (exchange)
```

### Briefing.WorkerFailure:fail

Authored path: `Briefing.WorkerFailure`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 98.

```reaction
when RequestBoundary.request (path: "/_worker/failure", report, requestId)
where
  view "report (report) can accept a worker outcome" with (report)
then
  Researching.fail (report)
```

### Briefing.WorkerFailure:fail#2

Authored path: `Briefing.WorkerFailure`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 98.

```reaction
when Researching.fail (report, stored), asked by Briefing.WorkerFailure:fail
where
  earlier, RequestBoundary.request (path: "/_worker/failure", report, requestId)
then
  RequestBoundary.respond (requestId, stored)
```

### Briefing.WorkerFailure:ignore

Authored path: `Briefing.WorkerFailure`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 98.

```reaction
when RequestBoundary.request (path: "/_worker/failure", report, requestId)
where
  no view "report (report) can accept a worker outcome" with (report)
then
  RequestBoundary.respond (requestId, stored: false)
```

### Briefing.WorkerRecover

Authored path: `Briefing.WorkerRecover`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 69.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 96.

```reaction
when RequestBoundary.request (exchange, path: "/_worker/recover", requestId)
then
  Exchanging.synchronize (exchange)
```

### Briefing.WorkerRecover#2

Authored path: `Briefing.WorkerRecover`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 69.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 96.

```reaction
when Exchanging.synchronize (exchange), asked by Briefing.WorkerRecover
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (exchange, path: "/_worker/recover", requestId)
then
  RequestBoundary.respond (exchange, requestId)
```

### Briefing.WorkerResult:ignore

Authored path: `Briefing.WorkerResult`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 97.

```reaction
when RequestBoundary.request (findingData, path: "/_worker/result", report, requestId, sourceData)
where
  no view "report (report) can accept a worker outcome" with (report)
then
  RequestBoundary.respond (requestId, stored: false)
```

### Briefing.WorkerResult:publish

Authored path: `Briefing.WorkerResult`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 97.

```reaction
when RequestBoundary.request (findingData, path: "/_worker/result", report, requestId, sourceData)
where
  view "report (report) can accept a worker outcome" with (report)
then
  Researching.finish (findingData, report, sourceData)
```

### Briefing.WorkerResult:publish#2

Authored path: `Briefing.WorkerResult`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 71.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 97.

```reaction
when Researching.finish (findingData, report, sourceData, stored), asked by Briefing.WorkerResult:publish
where
  earlier, RequestBoundary.request (findingData, path: "/_worker/result", report, requestId, sourceData)
then
  RequestBoundary.respond (requestId, stored)
```

### Briefing.WorkerWork

Authored path: `Briefing.WorkerWork`.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 54.
- Covered by [Reciprocal sharing and source briefs](../design/compositions/Briefing.md), line 95.

```reaction
when RequestBoundary.request (path: "/_worker/work", requestId)
then
  RequestBoundary.respond (requestId, work: former "source brief work")
```

### Cards.Archive

Authored path: `Cards.Archive`.
- Covered by [Private cards](../design/compositions/Cards.md), line 53.
- Covered by [Private cards](../design/compositions/Cards.md), line 65.

```reaction
when RequestBoundary.request (card, path: "/cards/archive", requestId, session)
then
  Sessioning.current (session)
```

### Cards.Archive#2

Authored path: `Cards.Archive`.
- Covered by [Private cards](../design/compositions/Cards.md), line 53.
- Covered by [Private cards](../design/compositions/Cards.md), line 65.

```reaction
when Sessioning.current (session, subject: owner), asked by Cards.Archive
where
  earlier, RequestBoundary.request (card, path: "/cards/archive", requestId, session)
then
  Collecting.archive (card, owner)
```

### Cards.Archive#3

Authored path: `Cards.Archive`.
- Covered by [Private cards](../design/compositions/Cards.md), line 53.
- Covered by [Private cards](../design/compositions/Cards.md), line 65.

```reaction
when Collecting.archive (card, owner), asked by Cards.Archive#2
where
  earlier, RequestBoundary.request (card, path: "/cards/archive", requestId, session)
then
  RequestBoundary.respond (card, requestId)
```

### Cards.Create

Authored path: `Cards.Create`.
- Covered by [Private cards](../design/compositions/Cards.md), line 18.
- Covered by [Private cards](../design/compositions/Cards.md), line 62.

```reaction
when RequestBoundary.request (label, pageTypes, path: "/cards/create", requestId, session, urls)
then
  Sessioning.current (session)
```

### Cards.Create#2

Authored path: `Cards.Create`.
- Covered by [Private cards](../design/compositions/Cards.md), line 18.
- Covered by [Private cards](../design/compositions/Cards.md), line 62.

```reaction
when Sessioning.current (session, subject: owner), asked by Cards.Create
where
  earlier, RequestBoundary.request (label, pageTypes, path: "/cards/create", requestId, session, urls)
then
  Collecting.create (label, owner, pageTypes, urls)
```

### Cards.Create:registered#3

Authored path: `Cards.Create`.
- Covered by [Private cards](../design/compositions/Cards.md), line 18.
- Covered by [Private cards](../design/compositions/Cards.md), line 62.

```reaction
when Collecting.create (label, owner, pageTypes, urls, card), asked by Cards.Create#2
at the flow's settlement frontier
where
  view "(viewer) can read card (item)" with (item: card, viewer: owner)
  earlier, RequestBoundary.request (label, pageTypes, path: "/cards/create", requestId, session, urls)
then
  RequestBoundary.respond (card, requestId)
```

### Cards.Create:unregistered#3

Authored path: `Cards.Create`.
- Covered by [Private cards](../design/compositions/Cards.md), line 18.
- Covered by [Private cards](../design/compositions/Cards.md), line 62.

```reaction
when Collecting.create (label, owner, pageTypes, urls, card), asked by Cards.Create#2
at the flow's settlement frontier
where
  no view "(viewer) can read card (item)" with (item: card, viewer: owner)
  earlier, RequestBoundary.request (label, pageTypes, path: "/cards/create", requestId, session, urls)
then
  RequestBoundary.respond (error: "CARD_NOT_READY", requestId)
```

### Cards.Get

Authored path: `Cards.Get`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.
- Covered by [Private cards](../design/compositions/Cards.md), line 64.

```reaction
when RequestBoundary.request (card, path: "/cards/get", requestId, session)
then
  Sessioning.current (session)
```

### Cards.Get:inaccessible#2

Authored path: `Cards.Get`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.
- Covered by [Private cards](../design/compositions/Cards.md), line 64.

```reaction
when Sessioning.current (session, subject: viewer), asked by Cards.Get
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (card, path: "/cards/get", requestId, session)
  no view "(viewer) can read card (item)" with (item: card, viewer)
then
  RequestBoundary.respond (error: "CARD_UNAVAILABLE", requestId)
```

### Cards.Get:readable#2

Authored path: `Cards.Get`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.
- Covered by [Private cards](../design/compositions/Cards.md), line 64.

```reaction
when Sessioning.current (session, subject: viewer), asked by Cards.Get
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (card, path: "/cards/get", requestId, session)
  view "(viewer) can read card (item)" with (item: card, viewer)
then
  RequestBoundary.respond (details: former "details for (card)" with (card), requestId)
```

### Cards.List

Authored path: `Cards.List`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.
- Covered by [Private cards](../design/compositions/Cards.md), line 63.

```reaction
when RequestBoundary.request (path: "/cards/list", requestId, session)
then
  Sessioning.current (session)
```

### Cards.List#2

Authored path: `Cards.List`.
- Covered by [Private cards](../design/compositions/Cards.md), line 37.
- Covered by [Private cards](../design/compositions/Cards.md), line 63.

```reaction
when Sessioning.current (session, subject: owner), asked by Cards.List
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (path: "/cards/list", requestId, session)
then
  RequestBoundary.respond (collection: former "cards owned by (owner)" with (owner), requestId)
```

### Cards.RegisterOwnership

Authored path: `Cards.RegisterOwnership`.
- Covered by [Private cards](../design/compositions/Cards.md), line 18.

```reaction
when Collecting.create (owner, card)
then
  Sharing.register (item: card, owner)
```

### Cards.RepairOwnership

Authored path: `Cards.RepairOwnership`.
- Covered by [Private cards](../design/compositions/Cards.md), line 28.

```reaction
when Sessioning.current (subject: owner)
where
  Collecting._byOwner (owner) has (card)
  Sharing._owned (item: card, viewer: owner) has (owned: false)
then
  Sharing.register (item: card, owner)
```

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Discovery.Authorize

Authored path: `Discovery.Authorize`.
- Covered by [Private cards](../design/compositions/Cards.md), line 3.
- Covered by [Private cards](../design/compositions/Cards.md), line 66.

```reaction
when RequestBoundary.request (path: "/_discovery/authorize", query, requestId, session)
then
  Sessioning.current (session)
```

### Discovery.Authorize#2

Authored path: `Discovery.Authorize`.
- Covered by [Private cards](../design/compositions/Cards.md), line 3.
- Covered by [Private cards](../design/compositions/Cards.md), line 66.

```reaction
when Sessioning.current (session, subject: user), asked by Discovery.Authorize
where
  earlier, RequestBoundary.request (path: "/_discovery/authorize", query, requestId, session)
  trimmed is trimQuery (query)
then
  RequestBoundary.respond (query: trimmed, requestId, user)
```

### Exchanges.Approve

Authored path: `Exchanges.Approve`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 63.

```reaction
when RequestBoundary.request (exchange, path: "/exchanges/approve", requestId, revision, session)
then
  Sessioning.current (session)
```

### Exchanges.Approve:approved#2

Authored path: `Exchanges.Approve`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 63.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Approve
where
  earlier, RequestBoundary.request (exchange, path: "/exchanges/approve", requestId, revision, session)
  view "(user) can approve (exchange) at (revision)" with (exchange, revision, user)
then
  Exchanging.approve (exchange, revision, user)
```

### Exchanges.Approve:approved#3

Authored path: `Exchanges.Approve`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 63.

```reaction
when Exchanging.approve (exchange, revision, user, status), asked by Exchanges.Approve:approved#2
where
  earlier, RequestBoundary.request (exchange, path: "/exchanges/approve", requestId, revision, session)
then
  RequestBoundary.respond (exchange, requestId, status)
```

### Exchanges.Approve:unavailable#2

Authored path: `Exchanges.Approve`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 63.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Approve
where
  earlier, RequestBoundary.request (exchange, path: "/exchanges/approve", requestId, revision, session)
  no view "(user) can approve (exchange) at (revision)" with (exchange, revision, user)
then
  RequestBoundary.respond (error: "APPROVAL_NOT_READY", requestId)
```

### Exchanges.End

Authored path: `Exchanges.End`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 64.

```reaction
when RequestBoundary.request (exchange, path: "/exchanges/end", requestId, session)
then
  Sessioning.current (session)
```

### Exchanges.End#2

Authored path: `Exchanges.End`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 64.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.End
where
  earlier, RequestBoundary.request (exchange, path: "/exchanges/end", requestId, session)
then
  Exchanging.end (exchange, user)
```

### Exchanges.End#3

Authored path: `Exchanges.End`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 64.

```reaction
when Exchanging.end (exchange, user), asked by Exchanges.End#2
at the flow's settlement frontier
where
  earlier, RequestBoundary.request (exchange, path: "/exchanges/end", requestId, session)
then
  RequestBoundary.respond (exchange, requestId)
```

### Exchanges.Invite

Authored path: `Exchanges.Invite`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 58.

```reaction
when RequestBoundary.request (card, path: "/exchanges/invite", requestId, session)
then
  Sessioning.current (session)
```

### Exchanges.Invite:owned-card#2

Authored path: `Exchanges.Invite`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 58.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Invite
where
  instant is the current flow's instant
  earlier, RequestBoundary.request (card, path: "/exchanges/invite", requestId, session)
  view "(user) can offer (card)" with (card, user)
  Collecting._offerPreview (card, owner: user) has (preview)
then
  Exchanging.open (first: user, item: card, now: instant, preview)
```

### Exchanges.Invite:owned-card#3

Authored path: `Exchanges.Invite`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 58.

```reaction
when Exchanging.open (first: user, item: card, now: instant, preview, exchange, invitation), asked by Exchanges.Invite:owned-card#2
where
  earlier, RequestBoundary.request (card, path: "/exchanges/invite", requestId, session)
then
  RequestBoundary.respond (exchange, invitation, requestId)
```

### Exchanges.Invite:unavailable-card#2

Authored path: `Exchanges.Invite`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 58.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Invite
where
  earlier, RequestBoundary.request (card, path: "/exchanges/invite", requestId, session)
  no view "(user) can offer (card)" with (card, user)
then
  RequestBoundary.respond (error: "CARD_UNAVAILABLE", requestId)
```

### Exchanges.Join

Authored path: `Exchanges.Join`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 59.

```reaction
when RequestBoundary.request (invitation, path: "/exchanges/join", requestId, session)
then
  Sessioning.current (session)
```

### Exchanges.Join#2

Authored path: `Exchanges.Join`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 59.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Join
where
  instant is the current flow's instant
  earlier, RequestBoundary.request (invitation, path: "/exchanges/join", requestId, session)
then
  Exchanging.join (invitation, now: instant, user)
```

### Exchanges.Join#3

Authored path: `Exchanges.Join`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 59.

```reaction
when Exchanging.join (invitation, now: instant, user, exchange), asked by Exchanges.Join#2
where
  earlier, RequestBoundary.request (invitation, path: "/exchanges/join", requestId, session)
then
  RequestBoundary.respond (exchange, requestId)
```

### Exchanges.List

Authored path: `Exchanges.List`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 62.

```reaction
when RequestBoundary.request (path: "/exchanges/list", requestId, session)
then
  Sessioning.current (session)
```

### Exchanges.List#2

Authored path: `Exchanges.List`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 34.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 62.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.List
where
  instant is the current flow's instant
  earlier, RequestBoundary.request (path: "/exchanges/list", requestId, session)
then
  RequestBoundary.respond (collection: former "exchanges for (user) at (instant)" with (instant, user), requestId)
```

### Exchanges.Offer

Authored path: `Exchanges.Offer`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 61.

```reaction
when RequestBoundary.request (card, exchange, path: "/exchanges/offer", requestId, revision, session)
then
  Sessioning.current (session)
```

### Exchanges.Offer:owned-card#2

Authored path: `Exchanges.Offer`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 61.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Offer
where
  earlier, RequestBoundary.request (card, exchange, path: "/exchanges/offer", requestId, revision, session)
  view "(user) can offer (card)" with (card, user)
  Collecting._offerPreview (card, owner: user) has (preview)
then
  Exchanging.offer (exchange, item: card, preview, revision, user)
```

### Exchanges.Offer:owned-card#3

Authored path: `Exchanges.Offer`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 61.

```reaction
when Exchanging.offer (exchange, item: card, preview, revision, user, result.revision: nextRevision), asked by Exchanges.Offer:owned-card#2
where
  earlier, RequestBoundary.request (card, exchange, path: "/exchanges/offer", requestId, revision, session)
then
  RequestBoundary.respond (exchange, requestId, revision: nextRevision)
```

### Exchanges.Offer:unavailable-card#2

Authored path: `Exchanges.Offer`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 3.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 61.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Offer
where
  earlier, RequestBoundary.request (card, exchange, path: "/exchanges/offer", requestId, revision, session)
  no view "(user) can offer (card)" with (card, user)
then
  RequestBoundary.respond (error: "CARD_UNAVAILABLE", requestId)
```

### Exchanges.Preview

Authored path: `Exchanges.Preview`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 7.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 60.

```reaction
when RequestBoundary.request (invitation, path: "/exchanges/preview", requestId, session)
then
  Sessioning.current (session)
```

### Exchanges.Preview#2

Authored path: `Exchanges.Preview`.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 7.
- Covered by [Invitations and offers](../design/compositions/Exchanges.md), line 60.

```reaction
when Sessioning.current (session, subject: user), asked by Exchanges.Preview
where
  instant is the current flow's instant
  earlier, RequestBoundary.request (invitation, path: "/exchanges/preview", requestId, session)
then
  RequestBoundary.respond (inviter: former "inviter of (invitation) for (user) at (instant)" with (instant, invitation, user), requestId)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/_discovery/authorize` — requires `session`, `query`
- `/_worker/failure` — requires `report`
- `/_worker/recover` — requires `exchange`
- `/_worker/result` — requires `report`, `sourceData`, `findingData`
- `/auth/current` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/auth/sign-in` — requires `username`, `password`
- `/auth/sign-out` — requires `session`
- `/cards/archive` — requires `session`, `card`
- `/cards/create` — requires `session`, `label`, `urls`, `pageTypes`
- `/cards/get` — requires `session`, `card`
- `/cards/list` — requires `session`
- `/exchanges/approve` — requires `session`, `exchange`, `revision`
- `/exchanges/end` — requires `session`, `exchange`
- `/exchanges/invite` — requires `session`, `card`
- `/exchanges/join` — requires `session`, `invitation`
- `/exchanges/list` — requires `session`
- `/exchanges/offer` — requires `session`, `exchange`, `card`, `revision`
- `/exchanges/preview` — requires `session`, `invitation`
- `/reports/get` — requires `session`, `report`
