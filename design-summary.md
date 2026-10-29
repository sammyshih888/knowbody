# P4 design summary

Samantha Shih

Knowbody lets two people exchange selected public pages before meeting. Each sees the kinds of pages the other person offers and approves before either selection is revealed. I kept that mutual exchange at the center of the app because learning about someone should not take away their choice of what to share.

## From the initial concept design

- **Accounts and sessions.** The [P1 design](https://github.com/sammyshih888/knowbody/blob/05e5dc09c8f0260cc11d1ed99375c74fc286aa0a/design.md#concept-design) separated accounts, cards, exchanges, access, and research. I kept those five concepts and added Sessioning so later requests can identify the signed-in account without asking for its password again. Reactions connect the concepts. Registration now starts a session automatically, so someone arriving through an invitation can create an account and continue.

- **Cards and approval.** I kept cards as fixed selections and tied both approvals to the same pair of offers. Replacing either offer clears both approvals, including when requests arrive together. Archiving a card stops future offers without ending agreements already made. Ending an exchange is separate because it removes access for both people.

- **Recovery after interruptions.** Sharing and page retrieval can finish at different times. I added recovery for incomplete ownership registration, sharing, and research, and stored cancellation so a late result cannot restore access after an exchange ends. The current runtime assumes one backend process.

## Invitations and access

- **Who can join.** I kept invitations usable by anyone signed in with the link so the recipient can register afterward. The recipient can see the inviter's username before joining, while the card stays hidden. A forwarded link could reach the wrong person, so the inviter sees the joining username and must confirm it through their existing chat before approving. Knowbody does not verify someone's identity. Before approval, each person sees the other's username and page types, but not their links.

- **Unused invitations last seven days.** I wanted people to have time to respond without leaving old links usable indefinitely. Ending the exchange cancels the invitation sooner. Older unused links have no recorded deadline, so I require a new invitation instead of guessing their age. Once someone has joined, the deadline no longer applies. Either person can end shared access, but the app cannot take back links or information already copied.

## Reading the sources

- **Comparing sources.** Search helps people find their own pages; only their saved selections are examined. The brief brings together direct links, repeated wording, and passages about work, education, or projects. If two pages name different employers, one may simply be old. I show the words, sources, and available dates so the reader can decide what the difference means. I left out AI summaries and trustworthiness scores because they could turn incomplete information into a judgment about someone.

- **Missing information.** Some public profiles cannot be read as HTML. Their links remain available with “Content not checked,” and missing dates are labeled separately from retrieval time. The topic rules use a limited English vocabulary and the first 20 passages, so comparisons can miss information. Pages that resolve to the same address are not treated as independent sources.

## From the P3 visual design

I kept the green and off-white palette, Georgia headings, DM Sans text, and faint leaf shapes from the [submitted P3 interface](https://github.com/sammyshih888/knowbody/tree/a1b3fe87a5f95d2414db28ddaacf12c6f539502a/web), developed through the [visual study](https://github.com/sammyshih888/knowbody/blob/a1b3fe87a5f95d2414db28ddaacf12c6f539502a/visual-study.pptx). Equal space for both offers makes the exchange feel mutual. Sources and comparisons stay grouped, with longer excerpts expandable.

For P4, I kept that layout and added the invitation deadline beside the link. An unusable invitation explains how to start another exchange. Opening or pasting an invitation leads to the same Join / Not now choice, with the sender shown before joining. Someone without a card gets a clear path to create one and return, while both people still need to offer a card before approving. The approval text explains what becomes visible and what ending cannot undo. I kept the red End exchange action near the top so people can stop sharing without scrolling through the briefs.
