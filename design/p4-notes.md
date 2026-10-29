# P4 design notes

### Initial plan

1. Review registration, invitations, approvals, and ending an exchange, including who can perform each action and read its results.
2. Test overlapping requests and interrupted work, then check the journey in the browser.
3. Refine the interface and update the specifications and README.
4. Summarize the design, test the deployed version, and record the final demo.

I started with access and consent because the app depends on people knowing what they have agreed to share.

### Design choices and changes

- Signing in after registration: Creating an account already means entering a username and password, so asking for them again added an unnecessary step. I made the Accounts reaction start a session after registration. Someone opening an invitation can now register and continue to join it. Authenticating creates the account, and Sessioning manages the session. Failed registration does not sign someone in.

- Keeping invitations separate from shared access: I let anyone signed in with the link join so the recipient can create an account after receiving it. A forwarded link could be claimed by the wrong person. I show the joining username and ask the inviter to confirm it through their existing chat before approving. Both people still have to approve before either card is shared. Ending removes access through the exchange, but cannot take back information someone already saved.

- Limiting unused invitations: I chose seven days so people have time to respond without leaving old links usable indefinitely. I kept the exact deadline with the sender's invitation controls to keep the recipient's decision screen simple. The server checks the deadline when someone joins. Older unused links have no recorded date, so I require a new invitation instead of guessing their age. Once someone has joined, both people can continue reviewing and approving their offers after the deadline.

- Making joining a separate choice: Signing in only identifies the account; it should not silently join an exchange. I gave invitations their own screen with Join invitation and Not now. Opening a link and pasting one into the app both lead to this screen, so the recipient can see the inviter's username before joining either way. The preview requires sign-in and a usable link, reveals no card information, and does not claim the invitation. Not now leaves the invitation open without notifying the sender, so someone with a forwarded link cannot decline it on the intended recipient's behalf.

- Helping someone who has no card yet: People can join before creating a card, but both still need to offer one before approving. I replaced the empty dropdown with a clear explanation and a Create a card button. Saving returns to the exchange, where they choose the card and save their offer. They can also leave the exchange waiting without sharing anything.

### Local validation

- The registration test first failed because no session was issued, then passed after the reaction changed. Failed registrations still issued no session. In the browser, registration opened the signed-in app, survived a reload, and preserved an incoming invitation.

- I tested a forwarded invitation being claimed by a third account. The inviter saw its username, while the card stayed private. A second claim was refused, one approval started no research, and the inviter could end the exchange. Other tests cover concurrent offers, stale approvals, and research finishing after access ends.

- I checked joining just before and exactly at the seven-day deadline, false times sent by a client, and expiry after a restart. Older unused links were refused; already-joined exchanges could still be approved. The browser showed how to replace an unusable invitation. Desktop and 390-pixel layouts had no horizontal overflow or console errors.

- I walked through a shared exchange with real public pages. One approval kept the links hidden; the second revealed both cards and started the briefs. An unreadable page kept its original link and an explanation. Ending removed the other person's links and brief while keeping my completed brief. I also checked long source links on desktop and mobile and gave them explicit text wrapping.

- I checked the invitation screen after both registration and sign-in, including keyboard focus and a 390-pixel screen. Not now left the sender's invitation unclaimed. Automated tests checked that the preview returned only the inviter's username and stopped exposing it when the invitation was unavailable. In the browser, I saw the sender's username before joining; ending the invitation hid it and disabled joining. I then reopened the link, joined without a card, created one, and returned to the same exchange. Saving the card did not offer it automatically, and saving the offer did not share the links. I also checked the case where all cards were archived.

- After making pasted invitations use the same preview, I checked full links, bare codes, malformed input, and cancelled invitations locally. Reviewing and Not now left the invitation unclaimed; only the final Join invitation connected the accounts. Code checks and the build passed. This later change still needs deployment.

- All 53 tests passed with 568 assertions. Specification, generated-contract, TypeScript, and build checks also passed. The 22 framework advisories concern response coverage and ordering; dependency build warnings remain. These automated results cover the local version; the deployed checks are recorded below.

- I followed the README from a fresh copy without `.env` or an existing dependency folder. Installation, building, code checks, and preview worked. The session, card, and ended exchange survived a restart. I used a separate database to leave saved app data intact.

### Deployed validation

I tested [the live app](https://knowbody.mit-sdg.dev) on October 28 using [commit ee79d7a](https://github.com/sammyshih888/knowbody/tree/ee79d7a6d4015e84e36246e6a5324b47905143e7), confirmed Healthy in the deployment dashboard. I used three separate test accounts for the browser journey and direct API checks.

- Persistence: Saved cards, approvals, and completed briefs survived reloads and signing out and back in. The ended exchange stayed ended, and each owner could still read their own completed brief. I did not restart the live server; restart recovery was tested locally.

- Access control: One approval revealed no partner links and started no brief. An unrelated account could not read the cards or briefs, even with their IDs, or approve or end the exchange. Reusing a claimed or cancelled invitation was refused. After ending, both participants lost access to the other's card and brief, including through direct requests. Archiving an already-shared card kept its existing agreement but blocked new invitations.

- Error handling and the journey: I checked automatic sign-in after registration, the inviter preview, Not now, creating a missing card and returning, and public-page search. Incorrect passwords and unusable invitations gave errors with a way to continue; direct requests also rejected invalid inputs. LinkedIn was readable during this run, so I used a confirmed missing page to check retrieval failure: it showed Content not checked, kept the link, and produced no comparisons. The exchange fit desktop and 390-pixel screens. I ended the test exchanges and archived their cards afterward.

[Saved automated test output](../tests/results.txt).
