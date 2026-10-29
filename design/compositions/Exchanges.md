# Invitations and offers

[Invite](reaction:Exchanges.Invite) and [change offer](reaction:Exchanges.Offer) require an [offerable](view:Exchanges.Offerable) card: owned, unarchived, and readable. [Join](reaction:Exchanges.Join) claims the invitation without approval.

These endpoints identify the user through Sessioning. Invite, Join, Preview, and List obtain the current time from sync-engine's `now` binding, never from the request. A new invitation can be claimed once, before its seven-day deadline. Older unused invitations without a stored deadline require replacement; already-joined exchanges continue normally.

[Preview](reaction:Exchanges.Preview) reads the [inviter's username](former:Exchanges.InvitationSender) for a signed-in holder of a usable invitation. It does not join the exchange or reveal its identifier, card, page types, or links. The inviter is null when unavailable. Join checks availability again when claiming the link.

Anyone signed in with the link can claim it, so forwarding it can connect the wrong account. Joining reveals usernames and page types, not the other card or its links. The inviter must recognize the joining account before approving. Ending closes an unused invitation or removes shared access; it cannot recall information already copied outside Knowbody.

```text
when UI.invite (user, card)
where Collecting: user owns card, card is unarchived, and its saved page types give preview
and Sharing: user can read card
and now(instant)
then Exchanging.open (user, card, preview, now: instant)

when UI.join (user, invitation)
where now(instant)
then Exchanging.join (user, invitation, now: instant)

when UI.previewInvitation (user, invitation)
where now(instant)
then UI.respond (inviter: Exchanges.InvitationSender(user, invitation, instant))

when UI.changeOffer (user, exchange, card, revision)
where Collecting: user owns card, card is unarchived, and its saved page types give preview
and Sharing: user can read card
then Exchanging.offer (user, exchange, card, preview, revision)
```

Unavailable cards receive CARD_UNAVAILABLE. Success returns exchange and, where applicable, invitation or revision. Exchanging enforces its own action conditions.

[List](reaction:Exchanges.List) returns a [participant-relative list](former:Exchanges.ExchangeList) with optional [partner username](former:Exchanges.Partner). Before activation it exposes only the other card's preview; shared material requires access. [Approve](reaction:Exchanges.Approve) checks the [current offerable pair](view:Exchanges.Approvable). [End](reaction:Exchanges.End) closes the exchange and waits for cleanup.

```text
when UI.listExchanges (user)
where now(instant)
then UI.respond (collection: Exchanges.ExchangeList(user, instant))

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
Exchanges.Preview at /exchanges/preview
Exchanges.Offer at /exchanges/offer
Exchanges.List at /exchanges/list
Exchanges.Approve at /exchanges/approve
Exchanges.End at /exchanges/end
```
