# Private cards

Search discovery remains a supporting service, as in P1. The host's `POST /api/search` accepts only `{ query }` (1–160 characters) and the session cookie. It passes the request through [Discovery.Authorize](reaction:Discovery.Authorize), so the standard HTTP adapter enforces method, origin, body limits, and session validation before any search. The internal `/_discovery/authorize` path is blocked from direct HTTP access.

The host calls Tavily basic search outside the state-change queue and returns `{ results: [{ url, title, snippet }] }`. Only public HTTPS candidates are returned. Results and queries are not stored or shared, and selecting a result only adds its URL to the unsaved form. Search never creates a card or report. Each account can search once per five seconds; the free provider quota is shared across the app. Search failures return SEARCH_UNAVAILABLE (503) or SEARCH_LIMIT (429). A missing key or exhausted quota leaves manual link entry available. No paid fallback is used.

```text
when Discovery.authorize (session, query)
then Sessioning.current (session): (user)
then Discovery.respond (user, query)
```

```computations
trimQuery(query: String) : String
  Removes surrounding whitespace from a validated search query without changing its words.
```

[Create](reaction:Cards.Create) waits for [ownership registration](reaction:Cards.RegisterOwnership), returning card if readable or CARD_NOT_READY otherwise.

```text
when UI.createCard (owner, label, urls, pageTypes)
then Collecting.create (owner, label, urls, pageTypes)

when Collecting.create (owner, label, urls, pageTypes): (card)
then Sharing.register (owner, card)
```

[RepairOwnership](reaction:Cards.RepairOwnership) retries missing registrations when a valid session identifies the owner. It uses Collecting's saved ownership, never a client-supplied owner. List and get wait for these effects before reading. Repeating registration for the same owner is safe; recovery never creates another card or grants another person access.

```text
when Sessioning.current (session): (owner)
where Collecting: owner has card
and Sharing: card is not registered to owner
then Sharing.register (owner, card)
```

[Readable](view:Cards.Readable) requires an existing card and [access](view:Access.Readable). [List](reaction:Cards.List) returns the owner's readable [cards](former:Cards.CardList); [get](reaction:Cards.Get) returns [details](former:Cards.CardDetails): card, label, URLs, page types, and archive state.

```text
when UI.listCards (owner)
then UI.respond (collection: Cards.CardList(owner))

when UI.getCard (viewer, card)
where Collecting: card exists
and Access.Readable(viewer, card)
then UI.respond (details: Cards.CardDetails(card))

when UI.getCard (viewer, card)
where card does not satisfy Cards.Readable(viewer, card)
then UI.respond (error: CARD_UNAVAILABLE)
```

[Archive](reaction:Cards.Archive) uses the signed-in owner to archive a card. Archived cards remain readable, but cannot be offered or approved for a new exchange. Existing active exchanges keep their access until ended.

```text
when UI.archiveCard (owner, card)
then Collecting.archive (owner, card)
then UI.respond (card)
```

```endpoints
Cards.Create at /cards/create
Cards.List at /cards/list
Cards.Get at /cards/get
Cards.Archive at /cards/archive
Discovery.Authorize at /_discovery/authorize
```
