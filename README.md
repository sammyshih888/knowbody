# Knowbody

A 6.1040 personal project about learning more before meeting someone. Two people approve an exchange of selected public profiles. Knowbody compares passages and explicit links within that selection.

[App](https://knowbody.mit-sdg.dev) · [User journey](#user-journey) · [Backend](./src/) · [Frontend](./web/) · [Current specifications](./design/) · [API reference](./generated/knowbody.md)

## Tests

With Bun 1.4.2 and Docker running, use:

```sh
bun install
bun run db:up
PUBLIC_ORIGIN=http://localhost:5173 MONGODB_URL='mongodb://dev:dev@127.0.0.1:27018/knowbody?authSource=admin' bun test
```

The [tests](./tests/) create and remove separate test databases, leaving app data intact. Search and page retrieval use fixtures, so no API key is needed. [Saved test output](./tests/results.txt).

## P2 Alpha (MVP)

[P2 video demo](https://youtu.be/mRnB3gWjQPk)

## P3 Beta

[P3 video demo](https://youtu.be/51wuxCRfxG4)

## P3 visual design study

[Typography and color study](./visual-study.pptx): two annotated slides, with reference credits in the speaker notes.

## User journey

Suppose Rachel and Simon are meeting for a first date. They want more context than a short dating-app bio, while each choosing which public pages to share.

1. **Make a private card.** Rachel registers and signs in. From Cards, she chooses New card and searches for her own pages or pastes links she knows. She selects her portfolio and a public biography, leaving an unrelated same-name result out. She names the card, chooses each page type, and saves it. Her links stay private.

2. **Invite Simon.** Rachel chooses New exchange in the top navigation, selects her card, and creates an invitation. She copies the link into their existing chat. Exchanges lists her ongoing exchanges with their status and next step. Opening one shows its details.

3. **Review and approve.** Simon follows the invitation, signs in, and joins. He offers a saved card, or creates one and returns to the exchange. Each sees their own links and only the other person's page types. Rachel checks that the joining account is Simon's. Both check the consent box and approve. One approval keeps links hidden; the second shares both cards and starts their briefs automatically. Replacing either offer before sharing clears both approvals.

4. **Read the shared pages.** On the exchange page, Rachel reads Simon's brief and can expand her own. Selected sources sit beside direct links, matching wording, and passages about work, education, or projects when available. Each comparison includes its sources and detected dates. She can expand excerpts or open the original pages. “Content not checked” means a page could not be read, without making a judgment about Simon.

5. **Archive an old card.** From Cards, Rachel archives a card she no longer wants to offer. It moves below current cards under Show archived cards. A pending exchange needs a replacement card before approval. Already-shared exchanges keep their access.

6. **End the exchange.** Rachel uses the red End exchange button near the top of its page. She can keep the exchange or confirm ending it. Confirming removes both people's access through the exchange and stops unfinished research. Each keeps their own cards and completed briefs. The exchange moves to the Ended list.

## P1 Design

Read the [complete design](./design.md), or go to a section:

- [Problem framing and stakeholders](./design.md#problem-framing)
- [Application pitch](./design.md#application-pitch)
- [Concept specifications](./design.md#concept-specifications)
- [Essential reactions](./design.md#essential-reactions)
- [Brief note](./design.md#brief-note)
- [UI sketches](./design.md#ui-sketches)
- [User journey](./design.md#user-journey)
