# Application portal test plan

For anyone testing the portal before launch, whether a teammate or an AI test
agent. Do the checks, write down what breaks, and report it in the format at
the bottom. **You're looking for bugs, not trying to get through the form.**
Anything confusing, ugly, slow or wrong counts.

## Where to test

- **Local** (developers and test agents): `npm run dev`, then
  `http://localhost:8080`. Uses the DH27BETA test event.
- **Live site** (teammates): `https://datahacks.ds3ucsd.com`, once the portal
  ships. Sign in with your own Google account.

Everything during testing goes to the **DH27BETA** test event. It gets wiped
before the real DH27 opens, so nothing you submit is permanent.

## Accounts (local only)

Blank accounts with no application yet. Open one in its own tab, which keeps
its own login:

| Account | Opens |
|---|---|
| `tester1@example.com` | `/dev/test-accounts?testAs=tester1%40example.com&go=/portal/apply/hacker` |
| `tester2@example.com` | `/dev/test-accounts?testAs=tester2%40example.com&go=/portal/apply/mentor-judge` |
| `tester3@example.com` | same as tester1, swapping in `tester3` |
| `tester4@example.com` | same as tester2, swapping in `tester4` |

More can be made with `node scripts/dev/create-dummy-applicant.mjs` (see the
top of that file). Filled-in dummy applicants are listed at
`/dev/test-accounts`.

Emails to `@example.com` go nowhere. To test emails, use a real address on the
live site.

## 1. Hacker application (`/portal/apply/hacker`)

**Fill it in badly first.** Before giving a valid answer, try each of these:

- [ ] Submit with everything empty. Does every required field say what's
      missing, and does the page take you to the first problem?
- [ ] Phone: `123`, `858-555-0100`, `+1 858 555 0100`, `(858)5550100`. Is it
      formatted as `(858) 555-0100`? Are bad numbers rejected?
- [ ] Birthdate: a date making you 12, a date in the future, and one making
      you 120.
- [ ] School search: type `ucsd`, `uc san diego`, `san diego uc`, `standford`,
      `toronto`, `mesa`. Is the right school near the top? Can you pick one
      with the keyboard only (arrows, then Enter)? What happens with a school
      that isn't listed?
- [ ] LinkedIn, GitHub and resume: `linkedin.com/in/x` (no https), `hello`,
      `http://` (not https), and a very long URL.
- [ ] Devpost is optional. Leave it empty.
- [ ] Travel reimbursement: answer **Yes**. Do the region, method, distance and
      reason fields appear? Switch to **No**: do they disappear, and does the
      form still submit?
- [ ] Multi-selects (race/ethnicity, heard about): pick several, then remove one.
- [ ] Essays: one character, then a very long paste of about 5,000 characters.
- [ ] Leave the terms box unticked.

**Then fill it in properly and submit.**

- [ ] Do you land on the Status page, showing "Under review"?
- [ ] Open **Application**. Is everything you entered there, spelled exactly as
      typed?
- [ ] Reload the page, sign out, then sign back in. Are you still "Under review"?
- [ ] Go back to `/portal/apply/hacker`. Can you submit a second application?
      (You shouldn't be able to.)

## 2. Mentor and judge application (`/portal/apply/mentor-judge`)

- [ ] Choose **mentor**, **judge** and **both** in turn. Do the right questions
      appear and disappear (judging track for judges, onsite mentoring for
      mentors)?
- [ ] Blurb (mentors): leave it empty, which should be allowed. Then 10
      characters, which should be rejected (the minimum is 50). Then 60
      characters, which should be accepted.
- [ ] There must be **no resume** field.
- [ ] UCSD affiliation: try each option.
- [ ] Submit. Are you on the Status page, showing "Under review"?

## 3. Organizer console (organizers only: `/organizer`)

- [ ] Accept, waitlist and reject a few people. **Each row should move to that
      tab at once**, marked "Not released".
- [ ] Clear a decision. Does the row go back to Applied?
- [ ] **Release decisions**. The confirm box wants `DH27BETA` typed in; try a
      wrong word first. After release, reload each applicant's tab:
  - **Accepted:** "Accepted", with the event pages unlocked.
  - **Waitlisted:** "Waitlisted", with Status and Application only.
  - **Rejected:** "Not accepted", with Status and Application only.
- [ ] Change someone who was released as accepted to rejected, then release
      again. They should lose the event pages and their check-in code.
- [ ] Download the CSV from each tab and open it in Google Sheets. Are any
      columns broken by commas or line breaks?
- [ ] Search by name, email and school.
- [ ] **Email** section (real addresses only): send a blast to one person. Did
      it arrive, and are the `{{first_name}}`-style placeholders filled in?
- [ ] **Send wallet passes**: does each accepted person get one email with a QR
      code, an Apple Wallet pass and a Google Wallet button?
- [ ] **Organizers** section: add a teammate's email. Can they open the
      console after signing in? Then remove them.

## 4. Check-in (organizers, at the door)

Codes look like `DH27BETA-H001` (hacker), `-M001` (mentor) and `-J001` (judge).

- [ ] Scan or type a hacker's, a mentor's and a judge's code. Each should show
      their name and role.
- [ ] Scan the same code again. It should say they're already checked in, with
      the time.
- [ ] Type the code in lowercase with spaces around it. It should still work.
- [ ] Type a made-up code, and a code from another event (`DH26-…`). Both
      should be "unknown".
- [ ] Undo a check-in, then scan again.
- [ ] In the console, is the person ticked under **Checked in**?
- [ ] As an accepted hacker, open **Mentors**. Check a mentor in, then reload:
      do they show as here?
- [ ] People who aren't organizers must not be able to check anyone in.

## 5. Everywhere

- [ ] Phone width (about 390px): the forms, the portal and the console. Is
      there any sideways scrolling, overlapping text or unclickable buttons?
- [ ] Moving between portal pages: does the screen flash white?
- [ ] The browser tab name should say which portal page you're on.
- [ ] Sign out from every page type. Do you land on a sign-in page?
- [ ] Use the browser back button after signing out. You shouldn't see private
      pages.
- [ ] Watch the browser console for red errors.

## Reporting a bug

One bug per entry:

```
Where:    page / URL, account used, phone or desktop
Did:      the exact steps, numbered
Expected: what should have happened
Got:      what happened (paste error text; screenshot if visual)
Severity: blocker (can't apply / wrong data) · bug · polish
```

Things that **aren't bugs** right now:
- Handbook pages marked "Draft — details coming soon".
- Event dates on the test event.
- Emails not arriving at `@example.com` addresses.
