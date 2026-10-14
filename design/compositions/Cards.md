# Private cards

[Create](reaction:Cards.Create) waits for [ownership registration](reaction:Cards.RegisterOwnership), returning card if readable or CARD_NOT_READY otherwise.

```text
when UI.createCard (owner, label, urls, pageTypes)
then Collecting.create (owner, label, urls, pageTypes)

when Collecting.create (owner, label, urls, pageTypes): (card)
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

```endpoints
Cards.Create at /cards/create
Cards.List at /cards/list
Cards.Get at /cards/get
```
