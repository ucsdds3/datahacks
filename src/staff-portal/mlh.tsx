import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { errorKind, friendlyError } from "@/lib/friendlyError";
import { EVENT_CODE, currentEventId } from "@/portal/event";
import { DATA_RETENTION, GENERAL_CONTACT_EMAIL, MLH_APPLICATION_PENDING, MLH_ENABLED } from "./config";
import { Req } from "./formFields";

/**
 * Major League Hacking (MLH) Member Event consent: the three checkboxes MLH
 * requires on the hacker application, the card that asks people who applied
 * before the switch was on, and the privacy notice above Submit.
 * How to switch it on: docs/mlh.md.
 */

/**
 * MLH's wording, word for word, from the "MLH Checkboxes" section of the MLH
 * 2027 Member Event Guidelines (last updated May 22, 2026):
 * https://github.com/MLH/mlh-policies/blob/main/member-event-guidelines.md
 * The MCP server keeps a copy (supabase/functions/mcp/application.ts);
 * src/portal/mcpApplication.test.ts checks they match.
 */
export const MLH_TEXT = {
  codeOfConduct: "I have read and agree to the MLH Code of Conduct.",
  dataSharing:
    "I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH/DEV administration (including the creation of linked accounts on MLH and DEV (dev.to)) in line with the MLH Privacy Policy. I further agree to the terms of both the MLH Contest Terms and Conditions and the MLH Privacy Policy.",
  emails: "I authorize MLH and DEV to send me occasional emails about relevant events, career opportunities, and community announcements.",
  /** MLH's note for events whose application is still pending (MLH_APPLICATION_PENDING). */
  pending:
    "We have applied to be a Major League Hacking (MLH) Member Event. The following checkboxes are only applicable if our application is accepted. Your information will not be shared if we do not become an MLH Member Event.",
} as const;

/** The links MLH gives with the checkboxes (same guidelines). */
export const MLH_LINKS = {
  codeOfConduct: "https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md",
  contestTerms: "https://github.com/MLH/mlh-policies/blob/main/contest-terms.md",
  privacyPolicy: "https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md",
  dev: "https://dev.to/",
} as const;

export type MlhAnswers = { mlh_code_of_conduct: boolean; mlh_data_sharing: boolean; mlh_emails_opt_in: boolean };
export const NO_MLH: MlhAnswers = { mlh_code_of_conduct: false, mlh_data_sharing: false, mlh_emails_opt_in: false };
export type MlhField = keyof MlhAnswers;

/** What to say when a required box isn't ticked. */
export const MLH_REQUIRED_MESSAGE: Partial<Record<MlhField, string>> = {
  mlh_code_of_conduct: "Agree to the MLH Code of Conduct to apply.",
  mlh_data_sharing: "Agree to sharing your application with MLH, and to MLH's Contest Terms and Privacy Policy, to apply.",
};

/** The first required MLH box that isn't ticked. */
export const mlhProblem = (answers: MlhAnswers): MlhField | null =>
  !answers.mlh_code_of_conduct ? "mlh_code_of_conduct" : !answers.mlh_data_sharing ? "mlh_data_sharing" : null;

/** The database's refusal when the switch is on and the boxes weren't ticked (applications_mlh_consent). */
export const isMlhRefusal = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && error.code === "23514" && (error.message ?? "").includes("MLH");

/**
 * The current event's events.mlh_required. False if it can't be read: a
 * database from before the switch existed, or a network blip (the database
 * still enforces it, and the form shows the boxes once it refuses).
 */
export async function fetchMlhRequired(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("events").select("mlh_required").eq("code", EVENT_CODE).maybeSingle();
    if (error) return false;
    return (data as { mlh_required?: boolean } | null)?.mlh_required === true;
  } catch {
    return false;
  }
}

export const MLH_REQUIRED_KEY = ["mlh-required"] as const;

/**
 * Whether MLH's checkboxes are on: MLH_ENABLED in config.ts, or the event's
 * mlh_required in the database. In `npm run dev`, `?preview&mlh` turns them on
 * for a look without changing either.
 */
export function useMlhOn(): boolean {
  // The URL itself rather than the router's, so it also works outside one (the organizer console's tables).
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const preview = import.meta.env.DEV && params.has("preview");
  const query = useQuery({ queryKey: MLH_REQUIRED_KEY, queryFn: fetchMlhRequired, enabled: !MLH_ENABLED && !preview, staleTime: 60_000 });
  if (MLH_ENABLED) return true;
  if (preview) return params.has("mlh");
  return query.data === true;
}

const External = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);

/** MLH_TEXT with MLH's links in it. */
export const MLH_LABEL: Record<MlhField, React.ReactNode> = {
  mlh_code_of_conduct: <>I have read and agree to the <External href={MLH_LINKS.codeOfConduct}>MLH Code of Conduct</External>.</>,
  mlh_data_sharing: (
    <>
      I authorize you to share my application/registration information with Major League Hacking for event administration,
      ranking, and MLH/DEV administration (including the creation of linked accounts on MLH and DEV
      (<External href={MLH_LINKS.dev}>dev.to</External>)) in line with the MLH Privacy Policy. I further agree to the terms of
      both the <External href={MLH_LINKS.contestTerms}>MLH Contest Terms and Conditions</External> and
      the <External href={MLH_LINKS.privacyPolicy}>MLH Privacy Policy</External>.
    </>
  ),
  mlh_emails_opt_in: MLH_TEXT.emails,
};

const FIELDS: { field: MlhField; id: string; required: boolean }[] = [
  { field: "mlh_code_of_conduct", id: "coc", required: true },
  { field: "mlh_data_sharing", id: "data", required: true },
  { field: "mlh_emails_opt_in", id: "emails", required: false },
];

export const mlhInputId = (prefix: string, field: MlhField) => `${prefix}-mlh-${FIELDS.find(f => f.field === field)!.id}`;

/**
 * The three checkboxes, as tiles like the form's other agreements. `invalid`
 * marks one red with `error` under it.
 */
export function MlhCheckboxes({ idPrefix, value, onChange, invalid = null, error = null, disabled = false }: {
  idPrefix: string;
  value: MlhAnswers;
  onChange: (field: MlhField, checked: boolean) => void;
  invalid?: MlhField | null;
  error?: string | null;
  disabled?: boolean;
}) {
  const errorId = `${idPrefix}-mlh-error`;
  return (
    <div className="sp-mlh-group">
      {MLH_APPLICATION_PENDING && <p className="sp-mlh-pending">{MLH_TEXT.pending}</p>}
      {FIELDS.map(({ field, required }) => (
        <div key={field} className="sp-mlh-item">
          <label className={`sp-check sp-mlh-check${invalid === field ? " sp-field-error" : ""}`}>
            <input
              id={mlhInputId(idPrefix, field)}
              type="checkbox"
              required={required}
              disabled={disabled}
              checked={value[field]}
              onChange={e => onChange(field, e.target.checked)}
              {...(invalid === field ? { "aria-invalid": true as const, "aria-describedby": errorId } : {})}
            />
            <span>{MLH_LABEL[field]} {required ? <Req /> : <em className="sp-optional">(optional)</em>}</span>
          </label>
          {invalid === field && error && <span className="sp-field-message" id={errorId} role="alert">{error}</span>}
        </div>
      ))}
    </div>
  );
}

type Consent = MlhAnswers | null;

async function fetchConsent(userId: string): Promise<Consent> {
  const eventId = await currentEventId();
  const { data, error } = await supabase
    .from("applications")
    .select("mlh_code_of_conduct, mlh_data_sharing, mlh_emails_opt_in")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .eq("applicant_type", "hacker")
    .maybeSingle();
  if (error) throw error;
  return (data as MlhAnswers | null) ?? null;
}

async function agree(emails: boolean): Promise<void> {
  const eventId = await currentEventId();
  const { error } = await supabase.rpc("agree_to_mlh", { p_event_id: eventId, p_emails_opt_in: emails });
  if (error) throw error;
}

/**
 * On a hacker's portal home while MLH is on, for people who applied before it
 * was: the two required MLH agreements and the optional emails one, saved on
 * their application (agree_to_mlh). Gone once they've agreed. Not shown to
 * people who weren't accepted, or if their consent can't be read.
 */
export function MlhConsentCard({ preview = false }: { preview?: boolean }) {
  const on = useMlhOn();
  const { session } = useAuth();
  const userId = session?.user.id;
  const client = useQueryClient();
  const [answers, setAnswers] = useState<MlhAnswers>(NO_MLH);
  const [invalid, setInvalid] = useState<MlhField | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["mlh-consent", userId],
    queryFn: () => fetchConsent(userId!),
    enabled: on && !preview && !!userId,
  });
  const mutation = useMutation({
    mutationFn: (emails: boolean) => (preview ? Promise.resolve() : agree(emails)),
    onSuccess: () => {
      setSaved(true);
      if (!preview) void client.invalidateQueries({ queryKey: ["mlh-consent", userId] });
    },
  });

  if (!on) return null;
  if (!preview && !query.isSuccess) return null;
  const agreed = !preview && !!query.data?.mlh_code_of_conduct && !!query.data?.mlh_data_sharing;
  if (!preview && !query.data) return null;
  if (saved) {
    return (
      <section className="sp-card sp-mlh-card done" aria-labelledby="sp-mlh-heading">
        <h2 id="sp-mlh-heading">Thanks, you're all set</h2>
        <p role="status">We've saved your MLH agreements on your application.</p>
      </section>
    );
  }
  if (agreed) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = mlhProblem(answers);
    setInvalid(problem);
    if (problem) {
      document.getElementById(mlhInputId("mlh-card", problem))?.focus();
      return;
    }
    mutation.mutate(answers.mlh_emails_opt_in);
  };

  return (
    <section className="sp-card sp-mlh-card" aria-labelledby="sp-mlh-heading">
      <h2 id="sp-mlh-heading">One more step: MLH</h2>
      <p>
        {MLH_APPLICATION_PENDING
          ? "We've applied for DataHacks to be a Major League Hacking (MLH) Member Event."
          : "DataHacks is a Major League Hacking (MLH) Member Event."}{" "}
        MLH asks everyone who applies to agree to the first two below. Your application stays as it is.
      </p>
      <form className="sp-form sp-mlh-form" onSubmit={submit} noValidate>
        <div className="sp-form-fields">
        <MlhCheckboxes
          idPrefix="mlh-card"
          value={answers}
          disabled={mutation.isPending}
          invalid={invalid}
          error={invalid ? MLH_REQUIRED_MESSAGE[invalid] ?? null : null}
          onChange={(field, checked) => {
            setAnswers(prev => ({ ...prev, [field]: checked }));
            if (field === invalid) setInvalid(null);
          }}
        />
        </div>
        {mutation.isError && (
          <p className="sp-error" role="alert">
            Couldn't save that. {errorKind(mutation.error) === "other" ? (mutation.error as Error).message : friendlyError(mutation.error)}
          </p>
        )}
        <div className="sp-mlh-actions">
          <button type="submit" className="sp-button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Above Submit on the application forms, always: what we collect, why, who sees it, for how long, how to delete it. */
export function PrivacyNotice({ mlh = false }: { mlh?: boolean }) {
  return (
    <section className="sp-privacy" aria-labelledby="sp-privacy-heading">
      <h2 id="sp-privacy-heading">Your privacy</h2>
      <ul>
        <li><strong>What we collect:</strong> your answers on this form and your sign-in email.</li>
        <li><strong>Why:</strong> to review applications, run DataHacks and contact you about it.</li>
        <li>
          <strong>Who sees it:</strong> DS3 organizers, and UC San Diego if it needs it to approve the event
          {mlh && <>. Major League Hacking (MLH) too, if you agree above</>}. We never sell it.
        </li>
        <li><strong>How long:</strong> {DATA_RETENTION}.</li>
        <li>
          <strong>Deleting it:</strong> email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a> to see or delete your data.
        </li>
      </ul>
    </section>
  );
}
