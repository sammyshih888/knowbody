# Authenticating

## Purpose

Identify users through their registered credentials.

## Principle

If a person registers a username and password, authenticating with the same credentials identifies them as the registered user.

## Types

```types
opaque PasswordHash
  A salted password verifier, never the original password.
```

## State

```state
a set of Users with
  a unique username String
  a passwordHash PasswordHash
```

## Actions

```actions
register(username: String, password: String) : returns (user: User)
  where username is not 1 to 32 letters, digits, underscores, or hyphens, or password is empty or longer than 128 characters
  then
    refuses INVALID_REGISTRATION "Use a username of 1 to 32 letters, numbers, underscores, or hyphens and a password of 1 to 128 characters."
  where the username already exists
  then
    refuses USERNAME_TAKEN "That username is already registered."
  where the credentials are valid and username is unused
  then
    create a user with username and a salted password hash
    returns user

authenticate(username: String, password: String) : returns (user: User)
  where no user has matching credentials
  then
    refuses INVALID_CREDENTIALS "The username or password is incorrect."
  where a user has matching credentials
  then
    identify the existing user without changing state
    returns user
```

## Queries

```queries
_get(user: User) : optional (username: String)
  Answers the user's username, or no row for an unknown user. Never returns the password hash.
```
