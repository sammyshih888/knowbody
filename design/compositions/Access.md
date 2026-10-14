# Reading shared material

[Readable](view:Access.Readable) is the state predicate used for card and report reads:

```text
Access.Readable(viewer, item) holds if
  Sharing: viewer is the registered owner of item
or
  Sharing: viewer has a surviving grant for item in scope exchange
  and Exchanging: exchange is ACTIVE
```
