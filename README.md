# Knowbody

A 6.1040 personal project about learning more before meeting someone. Two people approve an exchange of selected public profiles. Knowbody gathers source passages and checks explicit links within that selection.

[Backend](./src/) · [Frontend](./web/) · [Current specifications](./design/)

## Tests

With Bun 1.4.2 and Docker running, use:

```sh
bun install
bun run db:up
MONGODB_URL='mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin' bun test
```

The [tests](./tests/) create and remove separate test databases, leaving app data intact. Search and page retrieval use fixtures, so no API key is needed. [Saved test output](./tests/results.txt).

## P2 Alpha (MVP)

[P2 video demo](https://youtu.be/mRnB3gWjQPk)

## P3 visual design study

[Typography and color study](./visual-study.pptx): two annotated slides, with reference credits in the speaker notes.

## User journey

Rachel is planning to meet Simon and wants some context from the pages he chooses to share. She registers, signs in, and searches for her own public pages or pastes links she already knows. A same-name search result stays unselected. She chooses her portfolio and a public biography, sets their page types, and saves them as a private card. She creates an invitation and sends the link through their existing chat.

Simon signs in, joins the invitation, and offers two of his own public pages. Each can see their own links and only the kinds of pages the other person offers. After Rachel checks that the joining account is Simon's, both approve the current selection. Changing an offer before approval clears both approvals. Only mutual approval shares the links and starts a source brief for each person's pages.

Rachel reads Simon's source brief, with the selected sources beside their comparisons. She can expand a source excerpt or open the original page. The brief shows direct links, matching wording, and passages about work, education, or projects when supported by the selected pages. Each comparison keeps the wording beside its source and any detected page date. She can compare them without treating differences as proof of dishonesty. Unreadable pages are marked “Content not checked.”

Rachel can archive an old card to stop using it in new exchanges. Archiving keeps existing active exchanges intact. When she ends an exchange, both lose access through it inside Knowbody while retaining their own cards and completed briefs.

## P1 Design

Read the [complete design](./design.md), or go to a section:

- [Problem framing and stakeholders](./design.md#problem-framing)
- [Application pitch](./design.md#application-pitch)
- [Concept specifications](./design.md#concept-specifications)
- [Essential reactions](./design.md#essential-reactions)
- [Brief note](./design.md#brief-note)
- [UI sketches](./design.md#ui-sketches)
- [User journey](./design.md#user-journey)
