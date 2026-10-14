# Sharing

## Purpose

End access for one interaction without disturbing access for others.

## Principle

If an owner registers an item and grants a viewer access under two scopes, revoking one scope leaves the other grant available. Revoking the last grant ends the viewer's access. The owner keeps it.

## Types

```types
external User
  An owner or viewer.
external Item
  The identity of something that can be read.
external Scope
  An independent reason for granting access.
```

## State

```state
a set of OwnedItems with
  a unique item Item
  an owner User
a set of Scopes with
  a unique scope Scope
  a revoked Flag
a set of Grants with
  an item Item
  a viewer User
  a scope Scope
  unique item and viewer and scope
Rule: Revoked scopes never accept grants again. Ownership never changes. An unregistered item has no readers.
```

## Actions

```actions
register(owner: User, item: Item) : returns ()
  where item already has a different owner
  then
    refuses ITEM_REGISTERED "This item already has another owner."
  where item has no owner or already has owner
  then
    record owner as the item's owner
    returns

grant(owner: User, viewer: User, item: Item, scope: Scope) : returns ()
  where owner is not the item's recorded owner
  then
    refuses NOT_ITEM_OWNER "Only the owner can grant access."
  where owner is the item's recorded owner
  then
    add the grant if absent and scope has never been revoked
    returns

revoke(scope: Scope) : returns ()
  where true
  then
    permanently mark scope revoked and remove all grants with scope
    returns
```

## Queries

```queries
_readable(viewer: User, item: Item) : one (allowed: Flag)
  Answers true only if the item is registered and viewer is its owner or has a remaining grant. Otherwise answers false, including for an unknown item.

_owned(viewer: User, item: Item) : one (owned: Flag)
  Answers whether viewer is the registered owner, including false for unknown items.

_scopes(viewer: User, item: Item) : many (scope: Scope)
  Answers nonrevoked scopes granting viewer access to registered item, ordered by scope identity. Answers no rows for unknown items or absent grants.

_revoked(scope: Scope) : one (revoked: Flag)
  Answers whether scope has been revoked, including false for unknown scopes.
```
