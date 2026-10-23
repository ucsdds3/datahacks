import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { portal } from '@/portal/paths'
import { currentEventId } from '@/portal/event'
import { TIMELINE } from './config'
import { indexSchools, searchSchools } from './schoolSearch'
import { MAX_LENGTH, applicationErrorMessage, birthdateBounds, cleanLine, cleanText, isHttpsLink } from '@/lib/applicantInput'
import { Combobox, MultiSelect, PhoneInput, Req, Select, YesNo, isValidPhone } from './formFields'
import {
  COUNTRIES, GENDERS, GRADUATION_YEARS, HACKATHON_EXPERIENCE, HEARD_ABOUT, LEVELS_OF_STUDY, RACES, SCHOOLS,
  TRAVEL_DISTANCES, TRAVEL_METHODS,
} from './formOptions'

const SCHOOL_INDEX = indexSchools(SCHOOLS)
const findSchools = (query: string) => searchSchools(SCHOOL_INDEX, query)

const PRIORITY_LABEL = TIMELINE.priorityDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

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

export default function HackerApplication() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)

  const update = <K extends keyof Form>(field: K, value: Form[K]) => setForm(prev => ({ ...prev, [field]: value }))
  const text = (field: keyof Form) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(field, e.target.value as never),
  })

  /** What the browser's own checks can't catch: dropdown pickers, links and yes/no answers. */
  const problem = (): string | null => {
    if (!isValidPhone(form.phone)) return 'Enter a 10-digit phone number.'
    if (form.race_ethnicity.length === 0) return 'Choose at least one option for race/ethnicity.'
    if (form.attended_before === null) return 'Tell us whether you have attended DataHacks before.'
    const { min, max } = birthdateBounds()
    if (form.birthdate < min || form.birthdate > max) return 'Check your birthdate: you need to be at least 13.'
    if (!isHttpsLink(form.linkedin_url.trim())) return 'Enter a link to your LinkedIn profile, starting with https://.'
    if (!isHttpsLink(form.github_url.trim())) return 'Enter a link to your GitHub profile, starting with https://.'
    if (form.devpost_url.trim() && !isHttpsLink(form.devpost_url.trim())) return 'Your Devpost link should start with https://.'
    if (!isHttpsLink(form.resume_url.trim())) return 'Enter a link to your resume, starting with https://.'
    if (form.heard_about.length === 0) return 'Tell us how you heard about DataHacks.'
    if (form.wants_travel_stipend === null) return 'Tell us whether you need travel reimbursement.'
    if (form.wants_travel_stipend && (!form.travel_region.trim() || !form.travel_method || !form.travel_distance)) {
      return 'Fill in where and how you\'re traveling from.'
    }
    if (!form.agreed_to_terms) return 'You must agree to the terms.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!session) return setError('You must be signed in.')
    const issue = problem()
    if (issue) return setError(issue)

    setSubmitting(true)
    let eventId: string
    try {
      eventId = await currentEventId()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
      setError(applicationErrorMessage(insertError))
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['staff-application'] })
    navigate(portal.home, { replace: true })
  }

  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Hacker application</h1>
        <p>Applications submitted by {PRIORITY_LABEL} are reviewed in the priority batch.</p>
      </header>
      <form className="sp-card sp-form" onSubmit={handleSubmit}>
        <p className="sp-form-note">Fields marked <Req /> are required. You can't change your answers after submitting.</p>

        <div className="sp-form-fields">
          <h2 className="sp-form-section">About you</h2>
          <label>First name (as on your ID) <Req />
            <input required autoComplete="given-name" maxLength={MAX_LENGTH.name} {...text('first_name')} />
          </label>
          <label>Last name (as on your ID) <Req />
            <input required autoComplete="family-name" maxLength={MAX_LENGTH.name} {...text('last_name')} />
          </label>
          <label htmlFor="hk-phone">Phone number <Req />
            <PhoneInput id="hk-phone" value={form.phone} onChange={v => update('phone', v)} />
          </label>
          <label>Gender <Req />
            <Select options={GENDERS} value={form.gender} onChange={v => update('gender', v)} />
          </label>
          <div className="sp-field">
            <span className="sp-field-label" id="hk-race-label">Race/ethnicity <Req /></span>
            <MultiSelect options={RACES} value={form.race_ethnicity} onChange={v => update('race_ethnicity', v)} />
          </div>
          <label>Birthdate <Req />
            <input type="date" required min={birthdateBounds().min} max={birthdateBounds().max} {...text('birthdate')} />
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
          <div className="sp-field">
            <span className="sp-field-label">Have you attended DataHacks before? <Req /></span>
            <YesNo name="attended_before" value={form.attended_before} onChange={v => update('attended_before', v)} />
          </div>
          <label>LinkedIn profile <Req />
            <input type="url" required maxLength={MAX_LENGTH.link} placeholder="https://www.linkedin.com/in/…" {...text('linkedin_url')} />
          </label>
          <label>GitHub profile <Req />
            <input type="url" required maxLength={MAX_LENGTH.link} placeholder="https://github.com/…" {...text('github_url')} />
          </label>
          <label>Devpost profile <span>(optional)</span>
            <input type="url" maxLength={MAX_LENGTH.link} placeholder="https://devpost.com/…" {...text('devpost_url')} />
          </label>
          <label>Link to your resume <Req />
            <input type="url" required maxLength={MAX_LENGTH.link} placeholder="Google Drive, Dropbox or any link we can open" {...text('resume_url')} />
          </label>

          <h2 className="sp-form-section">A few questions</h2>
          <label>What's the project you're most proud of building? <Req />
            <textarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_proudest_project')} />
          </label>
          <label>What's something unique you'd bring? <Req />
            <textarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_unique_thing')} />
          </label>
          <label>What would you like to get out of this event? <Req />
            <textarea required rows={4} maxLength={MAX_LENGTH.essay} {...text('essay_goal')} />
          </label>
          <label>Funniest joke <span>(optional)</span>
            <textarea rows={2} maxLength={MAX_LENGTH.brief} {...text('funniest_joke')} />
          </label>
          <label>A lifetime goal of yours <span>(optional)</span>
            <textarea rows={2} maxLength={MAX_LENGTH.brief} {...text('lifetime_goal')} />
          </label>

          <h2 className="sp-form-section">How did you hear about DataHacks?</h2>
          <div className="sp-field">
            <span className="sp-field-label">Pick all that apply <Req /></span>
            <MultiSelect options={HEARD_ABOUT} value={form.heard_about} onChange={v => update('heard_about', v)} />
          </div>

          <h2 className="sp-form-section">Travel</h2>
          <div className="sp-field">
            <span className="sp-field-label">Would you need travel reimbursement to attend? <Req /></span>
            <YesNo name="wants_travel_stipend" value={form.wants_travel_stipend} onChange={v => update('wants_travel_stipend', v)} />
          </div>
          {form.wants_travel_stipend && (
            <>
              <label>Where are you traveling from? <Req />
                <input required maxLength={MAX_LENGTH.short} placeholder="City, state or country" {...text('travel_region')} />
              </label>
              <label>How are you traveling here? <Req />
                <Select options={TRAVEL_METHODS} value={form.travel_method} onChange={v => update('travel_method', v)} />
              </label>
              <label>How far are you traveling? <Req />
                <Select options={TRAVEL_DISTANCES} value={form.travel_distance} onChange={v => update('travel_distance', v)} />
              </label>
              <label>Anything else we should know about your travel? <span>(optional)</span>
                <textarea rows={3} maxLength={MAX_LENGTH.essay} {...text('travel_stipend_reason')} />
              </label>
            </>
          )}

          <label className="sp-check sp-agree">
            <input type="checkbox" required checked={form.agreed_to_terms} onChange={e => update('agreed_to_terms', e.target.checked)} />
            <span>I agree that all info above is correct and I'll abide by the code of conduct. <Req /></span>
          </label>
        </div>

        {error && <p className="sp-error" role="alert">{error}</p>}

        <div className="sp-form-actions">
          <button type="submit" className="sp-button primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </form>
    </div>
  )
}
