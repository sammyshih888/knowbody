# Invitations and offers

[Invite](reaction:Exchanges.Invite) and [change offer](reaction:Exchanges.Offer) require an [offerable](view:Exchanges.Offerable) card: owned, unarchived, and readable. [Join](reaction:Exchanges.Join) claims the invitation without approval.

```text
when UI.invite (user, card)
where Collecting: user owns card, card is unarchived, and its saved page types give preview
and Sharing: user can read card
then Exchanging.open (user, card, preview)

when UI.join (user, invitation)
then Exchanging.join (user, invitation)

when UI.changeOffer (user, exchange, card, revision)
where Collecting: user owns card, card is unarchived, and its saved page types give preview
and Sharing: user can read card
then Exchanging.offer (user, exchange, card, preview, revision)
```

Unavailable cards receive CARD_UNAVAILABLE. Success returns exchange and, where applicable, invitation or revision. Exchanging enforces its own action conditions.

[List](reaction:Exchanges.List) returns a [participant-relative list](former:Exchanges.ExchangeList) with optional [partner username](former:Exchanges.Partner). Before activation it exposes only the other card's preview; shared material requires access. [Approve](reaction:Exchanges.Approve) checks the [current offerable pair](view:Exchanges.Approvable). [End](reaction:Exchanges.End) closes the exchange and waits for cleanup.

```text
when UI.listExchanges (user)
then UI.respond (collection: Exchanges.ExchangeList(user))

when UI.approve (user, exchange, revision)
where Exchanging: user participates, exchange is OPEN at revision, and both offers exist
and Exchanges.Offerable(first participant, first card)
and Exchanges.Offerable(second participant, second card)
then Exchanging.approve (user, exchange, revision)

when UI.approve (user, exchange, revision)
where exchange does not satisfy Exchanges.Approvable(user, exchange, revision)
then UI.respond (error: APPROVAL_NOT_READY)

when UI.end (user, exchange)
then Exchanging.end (user, exchange)
```

Approval returns exchange and status after its flow settles; ending returns exchange. Concept refusals become error responses.

```endpoints
Exchanges.Invite at /exchanges/invite
Exchanges.Join at /exchanges/join
Exchanges.Offer at /exchanges/offer
Exchanges.List at /exchanges/list
Exchanges.Approve at /exchanges/approve
Exchanges.End at /exchanges/end
```
