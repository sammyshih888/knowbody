# Exchanging

## Purpose

Reach agreement on a two-way release without either person having to disclose first.

## Principle

If one person offers an item and another joins and makes an offer, both can approve the same selection to activate the exchange. Changing an offer clears both approvals. Either person can end it.

## Types

```types
external User
  A participant.
external Item
  Something offered in the exchange.
Status is OPEN or ACTIVE or ENDED
opaque ExchangeSummary
  A participant-relative record containing their own item and preview, the other preview, revision, status, and approval flags. It contains an invitation only for the inviter while unclaimed and open. It never contains the other item.
```

## State

```state
a set of Exchanges with
  a first User
  an optional second User
  a unique invitation String
  a firstItem Item
  a firstPreview String
  an optional secondItem Item
  an optional secondPreview String
  a revision Number
  an approvals set of User
  a status Status
Rule: Participants are distinct. Only participants approve. A revision identifies one fixed pair of offers. ACTIVE requires both offers and both approvals. ENDED never reopens.
```

## Actions

```actions
open(first: User, item: Item, preview: String) : returns (exchange: Exchange, invitation: String)
  where item is empty or preview is blank or exceeds 200 characters
  then
    refuses INVALID_INVITATION "Choose an item with a short preview."
  where item and preview are valid
  then
    create an OPEN exchange with first, item as firstItem, preview as firstPreview, revision 1, no second participant or offer, no approvals, and a fresh unguessable invitation
    returns exchange, invitation

join(user: User, invitation: String) : returns (exchange: Exchange)
  where no OPEN exchange has invitation and no second participant, or user is first
  then
    refuses INVITATION_UNAVAILABLE "This invitation cannot be joined. It may already be claimed or ended."
  where invitation identifies an OPEN exchange with no second participant and user differs from first
  then
    set second to user without approving or changing revision
    returns exchange

offer(user: User, exchange: Exchange, item: Item, preview: String, revision: Number) : returns (exchange: Exchange, revision: Number)
  where exchange is unknown, not OPEN, user is not a participant, revision is not the current positive integer, item is empty, or preview is blank or exceeds 200 characters
  then
    refuses OFFER_UNAVAILABLE "The offer could not be changed. Reload the current exchange and try again."
  where the exchange is OPEN, user participates, revision matches, and item and preview are valid
  then
    replace only user's offered item and preview, increase revision by one, and clear both approvals atomically
    returns exchange, revision

approve(user: User, exchange: Exchange, revision: Number) : returns (exchange: Exchange, status: Status)
  where exchange is unknown, not OPEN, user is not a participant, either offer is absent, or revision differs
  then
    refuses APPROVAL_UNAVAILABLE "The exchange cannot be approved at this revision."
  where user participates in an OPEN exchange with both offers at revision
  then
    add user to approvals and set status to ACTIVE if both participants have approved, otherwise OPEN
    returns exchange, status

end(user: User, exchange: Exchange) : returns (exchange: Exchange)
  where exchange is unknown, already ENDED, or user is not a participant
  then
    refuses END_UNAVAILABLE "This exchange cannot be ended by this account."
  where user participates in an OPEN or ACTIVE exchange
  then
    set status to ENDED
    returns exchange

synchronize(exchange: Exchange) : returns (exchange: Exchange, status: Status | null)
  where true
  then
    leave state unchanged
    let status be the current status or null for an unknown exchange
    returns exchange, status
```

## Queries

```queries
_byUser(user: User) : many (exchange: Exchange, summary: ExchangeSummary)
  Answers only exchanges in which user participates, ordered by exchange identity. Each summary contains that user's item and preview, the other offer's preview, revision, status, and approval flags. An unclaimed OPEN invitation is included only for its inviter. Answers no rows for a user with no exchanges, including an unknown user.

_counterparty(user: User, exchange: Exchange) : optional (other: User)
  Answers the other participant if user participates and both participants exist. Answers no row for unknown exchanges, outsiders, or an unclaimed invitation.

_lifecycle() : many (exchange: Exchange, status: Status)
  Answers ACTIVE and ENDED exchanges ordered by identity for host recovery, or no rows when none exist.

_active(exchange: Exchange) : one (active: Flag)
  Answers whether exchange is ACTIVE, including false for unknown exchanges.

_participant(user: User, exchange: Exchange) : one (participant: Flag)
  Answers whether user is a participant, including false for unknown exchanges.

_approvalPair(user: User, exchange: Exchange, revision: Number) : optional (first: User, second: User, firstItem: Item, secondItem: Item)
  Answers both participants and offered items only for an OPEN exchange at revision in which user participates and both offers exist. Otherwise answers no row.

_offers(exchange: Exchange) : many (owner: User, viewer: User, item: Item)
  Answers reciprocal offers for an ACTIVE exchange, first participant's offer then second participant's offer. Answers no rows otherwise.

_otherOffer(user: User, exchange: Exchange) : optional (owner: User, card: Item)
  Answers the other participant's offered item only for a participant in an ACTIVE exchange. Otherwise answers no row.
```
