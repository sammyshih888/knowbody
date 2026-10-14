# Collecting

## Purpose

Reuse a chosen set of source links without assembling it again.

## Principle

If a person creates a card, they can retrieve and reuse that exact selection. They can archive it when it is no longer useful. Creating a different selection leaves the earlier card intact.

## Types

```types
external User
  The owner of a card.
opaque UrlSelection
  A value containing a set of URL strings, transported as an array.
opaque PageTypes
  An array with one fixed category per URL: Public webpage, Personal site, Professional profile, Organization page, or Creative work.
```

## State

```state
a set of Cards with
  an owner User
  a label String
  a urls set of String
  a pageTypes PageTypes
  an archived Flag
Rule: A card's owner, label, URLs, and page types never change. Page types are owner-selected descriptions, not verified classifications.
```

## Actions

```actions
create(owner: User, label: String, urls: UrlSelection, pageTypes?: PageTypes) : returns (card: Card)
  where trimmed label is blank or exceeds 80 characters, urls is not one to five distinct HTTPS page URLs after normalization, a URL exceeds 2048 characters or contains credentials, a nondefault port, an IP literal, or a local/reserved hostname, or supplied pageTypes does not contain exactly one allowed category per URL
  then
    refuses INVALID_CARD "Add a label and one to five distinct public HTTPS page URLs."
  where label, urls, and any supplied pageTypes are valid
  then
    create a card with owner, trimmed label, normalized URLs with fragments removed, pageTypes defaulting to Public webpage per URL when absent, and archived false; preserve URL order and category correspondence
    returns card

archive(owner: User, card: Card) : returns (card: Card)
  where card does not exist or owner is not its owner
  then
    refuses CARD_NOT_OWNED "This card is not available to you."
  where owner owns card
  then
    set archived to true without changing its selection
    returns card
```

## Queries

```queries
_get(card: Card) : optional (owner: User, label: String, urls: UrlSelection, pageTypes: PageTypes, archived: Flag)
  Answers the saved card's fields, or no row for an unknown card. URL checks at creation are syntactic; public reachability is checked during retrieval.

_byOwner(owner: User) : many (card: Card, label: String, urls: UrlSelection, pageTypes: PageTypes, archived: Flag)
  Answers this owner's cards, including archived ones, ordered by label then card identity. Answers no rows for an owner without cards.

_offerPreview(owner: User, card: Card) : optional (preview: String)
  Answers a comma-separated list of fixed page types for a nonarchived card owned by owner. Answers no row for an unknown, archived, or differently owned card. Legacy cards without page types use Public webpage for each URL. Neither labels nor URL text contributes to the preview.
```
