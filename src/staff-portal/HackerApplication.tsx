import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { portal } from '@/portal/paths'
import { EVENT_CODE, currentEventId } from '@/portal/event'
import { useFormDraft } from '@/portal/formDraft'
import { errorKind, friendlyError } from '@/lib/friendlyError'
import { formatPacificDate } from '@/lib/pacificTime'
import { TIMELINE } from './config'
import { indexSchools, searchSchools } from './schoolSearch'
import { MAX_LENGTH, applicationErrorMessage, birthdateBounds, cleanLine, cleanText, isHttpsLink } from '@/lib/applicantInput'
import { Combobox, DateInput, LimitedTextarea, MultiSelect, PhoneInput, Req, Select, YesNo, phoneProblem } from './formFields'
import { ApplyWithAiNote, DraftNote, SignedOutNotice, focusField } from './formDraftUi'
import {
  COUNTRIES, GENDERS, GRADUATION_YEARS, HACKATHON_EXPERIENCE, HEARD_ABOUT, LEVELS_OF_STUDY, RACES, SCHOOLS,
  TRAVEL_DISTANCES, TRAVEL_METHODS,
} from './formOptions'

const SCHOOL_INDEX = indexSchools(SCHOOLS)
const findSchools = (query: string) => searchSchools(SCHOOL_INDEX, query)

// Deadlines are Pacific time wherever the applicant is (11:59 PM Pacific on Nov 29 is Nov 30 in New York).
const PRIORITY_LABEL = formatPacificDate(TIMELINE.priorityDeadline, { month: 'long', day: 'numeric' })
const REGULAR_LABEL = formatPacificDate(TIMELINE.regularDeadline, { month: 'long', day: 'numeric' })

const blank = {
  first_name: '', last_name: '', phone: '', gender: '', race_ethnicity: [] as string[], birthdate: '',
  country_of_residence: 'United States', city_of_residence: '', level_of_study: '', school: '',
  major: '', graduation_year: '', hackathon_experience: '', attended_before: null as boolean | null,
  linkedin_url: '', github_url: '', devpost_url: '', resume_url: '',
  essay_proudest_project: '', essay_unique_thing: '', essay_goal: '', funniest_joke: '', lifetime_goal: '',
  heard_about: [] as string[],
  wants_travel_stipend: null as boolean | null, travel_region: '', travel_method: '', travel_distance: '', travel_stipend_reason: '',
  agreed_to_terms: false,
}
type Form = typeof blank

/** Where each answer's control is, so a problem can focus and mark it. */
const FIELD_ID: Partial<Record<keyof Form, string>> = {
  phone: 'hk-phone', race_ethnicity: 'hk-race', attended_before: 'hk-attended', birthdate: 'hk-birthdate',
  linkedin_url: 'hk-linkedin', github_url: 'hk-github', devpost_url: 'hk-devpost', resume_url: 'hk-resume',
  heard_about: 'hk-heard', wants_travel_stipend: 'hk-travel', travel_region: 'hk-travel-region',
  travel_method: 'hk-travel-method', travel_distance: 'hk-travel-distance', agreed_to_terms: 'hk-agree',
}

type Problem = { field: keyof Form; message: string }

/** What the browser's own checks can't catch: dropdown pickers, links and yes/no answers. */
export function formProblem(form: Form, today = new Date()): Problem | null {
  const phone = phoneProblem(form.phone)
  if (phone) return { field: 'phone', message: phone }
  if (form.race_ethnicity.length === 0) return { field: 'race_ethnicity', message: 'Choose at least one option for race/ethnicity.' }
  if (form.attended_before === null) return { field: 'attended_before', message: 'Tell us whether you have attended DataHacks before.' }
  const { min, max } = birthdateBounds(today)
  if (form.birthdate < min || form.birthdate > max) return { field: 'birthdate', message: 'Check your birthdate: DataHacks is for people 18 and over.' }
  if (!isHttpsLink(form.linkedin_url.trim())) return { field: 'linkedin_url', message: 'Enter a link to your LinkedIn profile, starting with https://.' }
  if (!isHttpsLink(form.github_url.trim())) return { field: 'github_url', message: 'Enter a link to your GitHub profile, starting with https://.' }
  if (form.devpost_url.trim() && !isHttpsLink(form.devpost_url.trim())) return { field: 'devpost_url', message: 'Your Devpost link should start with https://.' }
  if (!isHttpsLink(form.resume_url.trim())) return { field: 'resume_url', message: 'Enter a link to your resume, starting with https://.' }
  if (form.heard_about.length === 0) return { field: 'heard_about', message: 'Tell us how you heard about DataHacks.' }
  if (form.wants_travel_stipend === null) return { field: 'wants_travel_stipend', message: 'Tell us whether you need travel reimbursement.' }
  if (form.wants_travel_stipend) {
    const missing = !form.travel_region.trim() ? 'travel_region' : !form.travel_method ? 'travel_method' : !form.travel_distance ? 'travel_distance' : null
    if (missing) return { field: missing, message: 'Fill in where and how you\'re traveling from.' }
  }
  if (!form.agreed_to_terms) return { field: 'agreed_to_terms', message: 'You must agree to the terms.' }
  return null
}

export default function HackerApplication() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState<keyof Form | null>(null)
  // The submit found the sign-in had expired (the session can look fine until a request is refused).
  const [expired, setExpired] = useState(false)
  const draft = useFormDraft({ form: 'hacker', eventCode: EVENT_CODE, userId: session?.user.id, blank })
  const { form, setForm } = draft
  // Signed out, or another tab switched this browser to a different account, since the form opened.
  const signedOut = expired || (draft.owner !== null && session?.user.id !== draft.owner)
  const { save } = draft
  useEffect(() => { if (signedOut) save() }, [signedOut, save])

  const update = <K extends keyof Form>(field: K, value: Form[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === invalid) { setInvalid(null); setError(null) }
  }
  const text = (field: keyof Form) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(field, e.target.value as never),
  })
  /** Marks the field a problem is about: red outline, aria-invalid, and the message under it. */
  const mark = (field: keyof Form) => (invalid === field ? { 'aria-invalid': true as const, 'aria-describedby': 'hk-field-error' } : {})
  const errorClass = (field: keyof Form, base = '') => [base, invalid === field ? 'sp-field-error' : ''].filter(Boolean).join(' ') || undefined
  const fieldError = (field: keyof Form) =>
    invalid === field && error ? <span className="sp-field-message" id="hk-field-error" role="alert">{error}</span> : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInvalid(null)
    if (!session || signedOut) return setExpired(true)
    const issue = formProblem(form)
    if (issue) {
      setInvalid(issue.field)
      setError(issue.message)
      focusField(FIELD_ID[issue.field])
      return
    }

    setSubmitting(true)
    // The session this tab has can be stale: check it's still the person who filled the form in.
    const { data: current } = await supabase.auth.getSession()
    if (!current.session || current.session.user.id !== draft.owner) {
      setSubmitting(false)
      setExpired(true)
      return
    }
    let eventId: string
    try {
      eventId = await currentEventId()
    } catch (err) {
      setError(`${friendlyError(err)} Your answers are saved on this device.`)
      setSubmitting(false)
      return
    }

    const travel = form.wants_travel_stipend
    const { error: insertError } = await supabase.from('applications').insert({
      applicant_type: 'hacker',
      event_id: eventId,
      user_id: session.user.id,
      email: session.user.email,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      ...form,
      first_name: cleanLine(form.first_name),
      last_name: cleanLine(form.last_name),
      city_of_residence: cleanLine(form.city_of_residence),
      school: cleanLine(form.school),
      major: cleanLine(form.major),
      essay_proudest_project: cleanText(form.essay_proudest_project),
      essay_unique_thing: cleanText(form.essay_unique_thing),
      essay_goal: cleanText(form.essay_goal),
      funniest_joke: cleanText(form.funniest_joke),
      lifetime_goal: cleanText(form.lifetime_goal),
      race_ethnicity: form.race_ethnicity.join('; '),
      attended_before: form.attended_before === true,
      wants_travel_stipend: travel === true,
      linkedin_url: form.linkedin_url.trim(),
      github_url: form.github_url.trim(),
      devpost_url: form.devpost_url.trim() || null,
      resume_url: form.resume_url.trim(),
      travel_region: travel ? cleanLine(form.travel_region) : null,
      travel_method: travel ? form.travel_method : null,
      travel_distance: travel ? form.travel_distance : null,
      travel_stipend_reason: travel ? cleanText(form.travel_stipend_reason) || null : null,
    })

    setSubmitting(false)
    if (insertError) {
      if (errorKind(insertError) === 'session') return setExpired(true)
      const message = applicationErrorMessage(insertError)
      setError(insertError.code === '23505' ? message : `${message} Your answers are saved on this device.`)
      return
    }

    draft.clear()
    await queryClient.invalidateQueries({ queryKey: ['staff-application'] })
    navigate(portal.home, { replace: true, state: { justSubmitted: true } })
  }

  const now = new Date()
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Hacker application</h1>
        <p>
          {now <= TIMELINE.priorityDeadline && <>Applications submitted by 11:59 PM Pacific on {PRIORITY_LABEL} are reviewed in the priority batch. </>}
          Applications close {REGULAR_LABEL} at 11:59 PM Pacific.
        </p>
      </header>
      <form className="sp-card sp-form" onSubmit={handleSubmit}>
        {signedOut && <SignedOutNotice as="hacker" otherAccount={session && session.user.id !== draft.owner ? session.user.email ?? '' : null} onLeave={save} />}
        <p className="sp-form-note">Fields marked <Req /> are required. You can't change your answers after submitting.</p>
        <DraftNote restoredAt={draft.restoredAt} onReset={draft.reset} />
        <ApplyWithAiNote />

        <div className="sp-form-fields">
          <h2 className="sp-form-section">About you</h2>
          <label>First name (as on your ID) <Req />
            <input required autoComplete="given-name" maxLength={MAX_LENGTH.name} {...text('first_name')} />
          </label>
          <label>Last name (as on your ID) <Req />
            <input required autoComplete="family-name" maxLength={MAX_LENGTH.name} {...text('last_name')} />
          </label>
          <label htmlFor="hk-phone" className={errorClass('phone')}>Phone number <Req />
            <PhoneInput id="hk-phone" value={form.phone} onChange={v => update('phone', v)} {...mark('phone')} />
            {fieldError('phone')}
          </label>
          <label>Gender <Req />
            <Select options={GENDERS} value={form.gender} onChange={v => update('gender', v)} />
          </label>
          <div className={errorClass('race_ethnicity', 'sp-field')}>
            <span className="sp-field-label" id="hk-race-label">Race/ethnicity <Req /></span>
            <MultiSelect id="hk-race" options={RACES} value={form.race_ethnicity} onChange={v => update('race_ethnicity', v)} {...mark('race_ethnicity')} />
            {fieldError('race_ethnicity')}
          </div>
          <label className={errorClass('birthdate')}>Birthdate <Req />
            <DateInput id="hk-birthdate" min={birthdateBounds().min} max={birthdateBounds().max} value={form.birthdate} onChange={v => update('birthdate', v)} {...mark('birthdate')} />
            {fieldError('birthdate')}
          </label>
          <label>Country of residence <Req />
            <Select options={COUNTRIES} value={form.country_of_residence} onChange={v => update('country_of_residence', v)} />
          </label>
          <label>City of residence <Req />
            <input required autoComplete="address-level2" maxLength={MAX_LENGTH.short} {...text('city_of_residence')} />
          </label>

          <h2 className="sp-form-section">School</h2>
          <label>Level of study <Req />
            <Select options={LEVELS_OF_STUDY} value={form.level_of_study} onChange={v => update('level_of_study', v)} />
          </label>
          <div className="sp-field">
            <label className="sp-field-label" htmlFor="hk-school">School <Req /></label>
            <Combobox id="hk-school" options={SCHOOLS} search={findSchools} value={form.school} onChange={v => update('school', v)} maxLength={MAX_LENGTH.short} placeholder="Start typing your school's name, or a nickname like UCSD" />
          </div>
          <label>Major <Req />
            <input required maxLength={MAX_LENGTH.short} {...text('major')} />
          </label>
          <label>Expected graduation year <Req />
            <Select options={GRADUATION_YEARS} value={form.graduation_year} onChange={v => update('graduation_year', v)} />
          </label>

          <h2 className="sp-form-section">Experience</h2>
          <label>Hackathons you've been to <Req />
            <Select options={HACKATHON_EXPERIENCE} value={form.hackathon_experience} onChange={v => update('hackathon_experience', v)} />
          </label>
          <div className={errorClass('attended_before', 'sp-field')}>
            <span className="sp-field-label">Have you attended DataHacks before? <Req /></span>
            <YesNo id="hk-attended" name="attended_before" value={form.attended_before} onChange={v => update('attended_before', v)} />
            {fieldError('attended_before')}
          </div>
          <label className={errorClass('linkedin_url')}>LinkedIn profile <Req />
            <input id="hk-linkedin" type="url" required maxLength={MAX_LENGTH.link} placeholder="https://www.linkedin.com/in/…" {...text('linkedin_url')} {...mark('linkedin_url')} />
            {fieldError('linkedin_url')}
          </label>
          <label className={errorClass('github_url')}>GitHub profile <Req />
            <input id="hk-github" type="url" required maxLength={MAX_LENGTH.link} placeholder="https://github.com/…" {...text('github_url')} {...mark('github_url')} />
            {fieldError('github_url')}
          </label>
          <label className={errorClass('devpost_url')}>Devpost profile <span>(optional)</span>
            <input id="hk-devpost" type="url" maxLength={MAX_LENGTH.link} placeholder="https://devpost.com/…" {...text('devpost_url')} {...mark('devpost_url')} />
            {fieldError('devpost_url')}
          </label>
          <label className={errorClass('resume_url')}>Link to your resume <Req />
            <input id="hk-resume" type="url" required maxLength={MAX_LENGTH.link} placeholder="Google Drive, Dropbox or any link we can open" {...text('resume_url')} {...mark('resume_url')} />
            {fieldError('resume_url')}
          </label>

          <h2 className="sp-form-section">A few questions</h2>
          <label>What's the project you're most proud of building? <Req />
            <LimitedTextarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_proudest_project')} />
          </label>
          <label>What's something unique you'd bring? <Req />
            <LimitedTextarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_unique_thing')} />
          </label>
          <label>What would you like to get out of this event? <Req />
            <LimitedTextarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_goal')} />
          </label>
          <label>Funniest joke <span>(optional)</span>
            <LimitedTextarea rows={2} maxLength={MAX_LENGTH.brief} {...text('funniest_joke')} />
          </label>
          <label>A lifetime goal of yours <span>(optional)</span>
            <LimitedTextarea rows={2} maxLength={MAX_LENGTH.brief} {...text('lifetime_goal')} />
          </label>

          <h2 className="sp-form-section">How did you hear about DataHacks?</h2>
          <div className={errorClass('heard_about', 'sp-field')}>
            <span className="sp-field-label">Pick all that apply <Req /></span>
            <MultiSelect id="hk-heard" options={HEARD_ABOUT} value={form.heard_about} onChange={v => update('heard_about', v)} {...mark('heard_about')} />
            {fieldError('heard_about')}
          </div>

          <h2 className="sp-form-section">Travel</h2>
          <div className={errorClass('wants_travel_stipend', 'sp-field')}>
            <span className="sp-field-label">Would you need travel reimbursement to attend? <Req /></span>
            <YesNo id="hk-travel" name="wants_travel_stipend" value={form.wants_travel_stipend} onChange={v => update('wants_travel_stipend', v)} />
            {fieldError('wants_travel_stipend')}
          </div>
          {form.wants_travel_stipend && (
            <>
              <label className={errorClass('travel_region')}>Where are you traveling from? <Req />
                <input id="hk-travel-region" required maxLength={MAX_LENGTH.short} placeholder="City, state or country" {...text('travel_region')} {...mark('travel_region')} />
                {fieldError('travel_region')}
              </label>
              <label className={errorClass('travel_method')}>How are you traveling here? <Req />
                <Select id="hk-travel-method" options={TRAVEL_METHODS} value={form.travel_method} onChange={v => update('travel_method', v)} />
                {fieldError('travel_method')}
              </label>
              <label className={errorClass('travel_distance')}>How far are you traveling? <Req />
                <Select id="hk-travel-distance" options={TRAVEL_DISTANCES} value={form.travel_distance} onChange={v => update('travel_distance', v)} />
                {fieldError('travel_distance')}
              </label>
              <label>Anything else we should know about your travel? <span>(optional)</span>
                <LimitedTextarea rows={3} maxLength={MAX_LENGTH.essay} {...text('travel_stipend_reason')} />
              </label>
            </>
          )}

          <label className={errorClass('agreed_to_terms', 'sp-check sp-agree')}>
            <input id="hk-agree" type="checkbox" required checked={form.agreed_to_terms} onChange={e => update('agreed_to_terms', e.target.checked)} {...mark('agreed_to_terms')} />
            <span>I agree that all info above is correct and I'll abide by the code of conduct. <Req /></span>
          </label>
          {fieldError('agreed_to_terms')}
        </div>

        {error && !invalid && <p className="sp-error" role="alert">{error}</p>}

        <div className="sp-form-actions">
          <button type="submit" className="sp-button primary" disabled={submitting || signedOut}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </form>
    </div>
  )
}
