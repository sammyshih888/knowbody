# Sessioning

## Purpose

Remember an authenticated subject until a temporary session expires or ends.

## Principle

Starting a session for a subject yields an unguessable token. The token resolves to that subject for 30 minutes. Ending it makes it unusable without ending other sessions for that subject.

## Types

```types
external Subject
  The identity remembered by a session.
```

## State

```state
a set of Sessions with
  a subject Subject
  an expiresAt DateTime
Rule: Session tokens are unguessable and their stored identifiers are one-way hashes.
```

## Actions

```actions
start(subject: Subject) : returns (session: Session, expiresAt: DateTime)
  where true
  then
    create a fresh opaque session for subject expiring 30 minutes after creation
    returns session, expiresAt

current(session: Session | null) : returns (subject: Subject)
  where session is absent, unknown, ended, or expired
  then
    refuses UNKNOWN_SESSION "Please sign in to continue."
  where session is active
  then
    identify its subject without extending its expiry
    returns subject

end(session: Session | null) : returns (ended: Flag)
  where true
  then
    remove this session if present, leaving other sessions unchanged
    set ended to true
    returns ended
```

## Queries

```queries
```
