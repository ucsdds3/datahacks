# DocuSign PowerForm waiver

The liability waiver is signed on UC San Diego's DocuSign account through a
PowerForm (Paul at UCSD gave Mohak the Forms Manager role and recommended
PowerForms over the API). The portal's waiver page links to it with the
person's name, email and application id filled in. DocuSign doesn't tell us
who signed, so organizers import DocuSign's CSV export in the organizer console
(Waivers), and the check-in desk can mark someone who shows their DocuSign
completion email.

The older embedded flow (DocuSign API + `docusign-waiver` edge function,
`docs/docusign-waiver.md`) is still in the code. `DOCUSIGN.mode = "embedded"`
in `src/staff-portal/config.ts` brings it back.

## What already exists (set up 2026-11-05)

| What | Value |
| --- | --- |
| Account | UC San Diego campus DocuSign, `na1`, account `6371e373-11ff-4359-aa24-bf2ccbddc944` |
| Template | "DataHacks 2027 Liability Waiver", one placeholder role **Participant** |
| Fields | Sign Here, Date Signed, Full Name, Email, and a Text field with data label **`datahacks_id`** (read-only, not required) |
| PowerForm | "DataHacks 2027 Liability Waiver", id `bed6ac13-bb24-44ef-84b1-1ede0ce183c1`, **Email Validation on** (signers get a code by email, so the email in the export is verified) |
| Config | `DOCUSIGN` in `src/staff-portal/config.ts`: `powerFormUrl` (set), `roleName: "Participant"`, `idFieldLabel: "datahacks_id"`, `waiverPublished: false` |

The waiver PDF isn't in this repo. The template currently holds a draft that
says "DRAFT FOR TESTING. Wording to be reviewed by DS3 and UC San Diego before
use." While `waiverPublished` is `false`, the portal shows "Waiver opens soon"
instead of the Sign button.

## What's left for Mohak

1. **Swap in the final PDF.** In DocuSign: **Templates** → open "DataHacks 2027
   Liability Waiver" → **Edit**. Under Documents, open the draft's menu (⋯) →
   **Replace** → upload the final PDF. Check that the five fields still sit on
   the right lines (move them if the layout changed) → **Save and Close**.
   DocuSign says template changes can take up to 20 minutes to reach the
   PowerForm.
2. **Test it once.** In a private window, open the link below, with your own
   name and email instead of the sample ones:
   `https://www.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=bed6ac13-bb24-44ef-84b1-1ede0ce183c1&env=na1&acct=6371e373-11ff-4359-aa24-bf2ccbddc944&v=2&Participant_UserName=Test%20Person&Participant_Email=you%40ucsd.edu&Participant_datahacks_id=TEST-123&datahacks_id=TEST-123`
   With name and email in the link, DocuSign skips its "enter your name and
   email" page and emails the code straight away (checked 2026-11-05). Enter
   the code and sign.
   - The `datahacks_id` field should read `TEST-123`. If it's empty, DocuSign
     isn't filling read-only fields from the link: edit the template, select
     the field, untick **Read Only**, save. (The import still matches by
     email if the field stays empty.)
3. **Open it.** Set `waiverPublished: true` in `src/staff-portal/config.ts` and
   merge. The Sign button appears on every accepted person's waiver page.

## Importing signatures (about once a day)

1. DocuSign → **Agreements** → **PowerForms** (left panel) → "DataHacks 2027
   Liability Waiver" → **Download**. (There must be at least one response.)
2. Start Date: the day the waiver opened. End Date: today. Format: **CSV** →
   **Download**. DocuSign lists one completed envelope per row, with the
   signer's columns prefixed `Role 1::` and the `datahacks_id` and Date Signed
   field values. If the download times out, pick a shorter date range and
   import each file; importing the same rows again is safe.
3. Organizer console → **Waivers** → **Choose CSV…**. Nothing is saved yet.
   The preview sorts rows into To record / Already on file / Not matched / Not
   completed, with the reason for each.
4. **Record N waivers** → OK. The portal, the console and the check-in app show
   "Waiver ✓" right away.

How rows match: first by `datahacks_id` (the person's application id for this
event), else by email (any case) among this event's accepted applications. Only
accepted applications with a portal account are recorded. Someone who already
has a waiver keeps the first one, and the earliest signature in a file wins.

Also accepted: an **Envelope Recipient Report** export (DocuSign → Reports →
Envelope Recipient Report, filtered to this waiver's subject, with Envelope ID,
Status, Recipient Email and Recipient Signed columns → Export → CSV). It has no
field values, so those rows match by email only. Columns are found by header
name in any case.

## At the check-in desk

- The check-in app's "No waiver · Sign now" sheet shows a QR code to the
  person's portal waiver page.
- If they show DocuSign's "Completed" email for the DataHacks waiver, tap **They
  showed me the signed confirmation → Mark signed** in that sheet (needs a
  connection). The pill turns to "Waiver ✓".
- In the console: **Waivers** → No waiver yet → **Mark signed**. It asks for an
  optional note.

Both record source `manual` and who marked it (`public.waivers.source`,
`recorded_by`, `note`).

## Recreating it from scratch

Only if the template or PowerForm is lost. You need DocuSign's Forms Manager /
PowerForm Administrator permission.

1. **Template:** **Templates** → **Start** → **Envelope Templates** → **Create
   a Template**. Name it, upload the waiver PDF, then **Add Recipient**: Role
   `Participant` (exactly as in config), Name and Email left empty, Needs to
   Sign. **Next**, then from Standard Fields add Signature, Date Signed, Name
   (Full Name) and Email, and a Text field with **Data Label** `datahacks_id`,
   **Read Only** ticked, **Required** unticked. **Save and Close**.
2. **PowerForm:** **Agreements** → **Start** → **Create PowerForm** → pick the
   template → **Add selected**. Keep the name and email subject. In
   Instructions for First Recipient, write something like "Use the email you
   applied to DataHacks with." On the **Options** tab, tick **Email
   Validation**. Leave usage limits empty → **Create**.
3. **Config:** copy the URL from the Copy PowerForm URL dialog into
   `DOCUSIGN.powerFormUrl`. If the role or field label differ, update
   `roleName` / `idFieldLabel` too.

## The link the portal builds

DocuSign's "Parameters to Pre-Populate Information in a PowerForm"
(support.docusign.com, Docusign eSignature - PowerForms) lists
`<RoleName>_UserName=`, `<RoleName>_Email=`, `<DataLabel>=` for a field, and
`<RoleName>_<DataLabel>=` for a field named for one role. The portal appends,
URL-encoded (`src/staff-portal/powerForm.ts`):

```
&Participant_UserName=<first last>&Participant_Email=<application email>
&Participant_datahacks_id=<application id>&datahacks_id=<application id>
```

The id goes in both field forms: the label has an underscore, which is also
DocuSign's role separator, and users report that bare labels with underscores
don't fill in. DocuSign ignores whichever form it doesn't use.
