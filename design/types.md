# Knowbody application types

The application implements accounts, browser sessions, private cards, and exchange state. Sessioning makes the application session mentioned in P1 explicit. It is a supporting mechanism; the five product concepts remain in the P1 design. Sharing stores namespaced card and report identities and uses exchange identities as access scopes.

```types
concrete SharedItem
  A namespaced card or report identity.
```

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.User

instantiate Collecting with
  User is Authenticating.User

instantiate Sharing with
  User is Authenticating.User
  Item is SharedItem
  Scope is Exchanging.Exchange

instantiate Researching with
  User is Authenticating.User
  Context is Exchanging.Exchange

instantiate Exchanging with
  User is Authenticating.User
  Item is Collecting.Card
```
