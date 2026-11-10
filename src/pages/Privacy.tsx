import { useEffect } from "react";
import { DATA_RETENTION, GENERAL_CONTACT_EMAIL } from "@/staff-portal/config";
import "./privacy.css";

const UPDATED = "November 9, 2026";
const mail = <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>;

/**
 * The privacy policy: what the portal collects and why, in plain words. Linked from Google's sign-in
 * screen (the OAuth app's Branding page needs a public privacy policy URL) and worth linking anywhere
 * people apply. The short version sits above Submit on both application forms (PrivacyNotice).
 */
export default function Privacy() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Privacy policy · DataHacks";
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="dh-privacy">
      <p className="dh-privacy-org"><a href="/">DataHacks</a> · Data Science Student Society (DS3) at UC San Diego</p>
      <h1>Privacy policy</h1>
      <p className="dh-privacy-updated">Last updated {UPDATED}</p>

      <p>
        DataHacks is a student-run hackathon organized by the Data Science Student Society (DS3) at UC San Diego. This page explains
        what we collect when you use the DataHacks website and application portal, why, and what you can do about it. Questions: {mail}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you sign in with Google:</strong> your name, email address and Google account ID. We use them only to sign you in
          and to know which application is yours. We never see your Google password and get no other access to your Google account.
        </li>
        <li>
          <strong>Your application:</strong> the answers you give on the hacker or mentor/judge application, such as contact details,
          school or organization, experience, the links you share, your short answers, travel needs, how you heard about us, and
          the agreements you tick. Demographic questions are used only in aggregate.
        </li>
        <li>
          <strong>If you're accepted:</strong> your liability waiver status, event check-in and meal scans, and your event pass.
        </li>
        <li>
          <strong>Website analytics:</strong> basic, anonymous usage data (pages viewed, device and approximate location) through
          Google Analytics. It doesn't include your application answers.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To review applications and decide who's accepted.</li>
        <li>To email you about your application, your decision and the event.</li>
        <li>To run the event: check-in, meals, mentoring and judging.</li>
        <li>
          To plan future events, using totals only. Our public stats page shows only counts, and any group of fewer than five people
          is combined into "Other".
        </li>
      </ul>

      <h2>Who sees it</h2>
      <ul>
        <li>DataHacks / DS3 organizers who run the event.</li>
        <li>UC San Diego, if it needs it to approve or run the event safely.</li>
        <li>
          The services that run the site for us, only to provide that service: Supabase (database and sign-in), Google (sign-in,
          email and analytics), GitHub (website hosting) and DocuSign (waivers).
        </li>
        <li>
          Major League Hacking (MLH), only if DataHacks is an MLH Member Event and you agree to it on the application.
        </li>
      </ul>
      <p>We never sell your information.</p>
      <p>
        DataHacks' use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>How long we keep it</h2>
      <p>Application data is kept {DATA_RETENTION}.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Email {mail} to see, correct or delete your data, or to withdraw your application.</li>
        <li>
          You can remove DataHacks' access to your Google account at any time in your{" "}
          <a href="https://myaccount.google.com/connections">Google account settings</a>.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Your application can be read only by you and by DataHacks organizers. Data is encrypted in transit, and access is checked by
        the database itself, not just the website.
      </p>

      <h2>Age</h2>
      <p>DataHacks is for people 18 and over. We don't knowingly collect information from anyone younger.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we'll update this page and the date at the top.</p>

      <p className="dh-privacy-back"><a href="/">&larr; Back to DataHacks</a></p>
    </main>
  );
}
