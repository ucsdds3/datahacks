import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { portal } from '@/portal/paths'
import { EVENT_CODE, currentEventId } from '@/portal/event'
import { useFormDraft } from '@/portal/formDraft'
import { requestReceivedEmail } from '@/portal/receivedEmail'
import { errorKind, friendlyError } from '@/lib/friendlyError'
import { MAX_LENGTH, applicationErrorMessage, cleanLine, cleanText, isHttpsLink, isValidEmail } from '@/lib/applicantInput'
import { LimitedTextarea, MultiSelect, PhoneInput, Req, isValidPhone, phoneProblem } from './formFields'
import { ApplyWithAiNote, DraftNote, SignedOutNotice, focusField } from './formDraftUi'
import { MENTOR_ONSITE_ACKNOWLEDGEMENT } from './config'
import { STAFF_HEARD_ABOUT } from './formOptions'
import { PrivacyNotice } from './mlh'

type ApplicantType = 'mentor' | 'judge' | 'hybrid'

const applicantTypeOptions: { value: ApplicantType; label: string }[] = [
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
  { value: 'hybrid', label: 'Both' },
]

const ucsdOptions = [
  { value: 'student', label: 'UCSD Student' },
  { value: 'alumni', label: 'UCSD Alumni' },
  { value: 'faculty', label: 'UCSD Faculty Member' },
  { value: 'none', label: 'Not Affiliated with UCSD' },
]

const trackOptions = [
  { value: 'social_good', label: 'Social Good' },
  { value: 'biotech_life_sciences', label: 'Biotech & Life Sciences' },
  { value: 'defense_cybersecurity', label: 'Defense & Cybersecurity' },
  { value: 'finance', label: 'Finance' },
  { value: 'entertainment', label: 'Entertainment' },
]


const blank = {
  first_name: '',
  last_name: '',
  phone: '',
  organization: '',
  role_title: '',
  linkedin_url: '',
  ucsd_affiliation: '',
  applicant_type: '' as ApplicantType | '',
  judging_track: '',
  bio: '',
  heard_about: [] as string[],
  acknowledged_in_person_judging: false,
  acknowledged_onsite_mentoring: false,
  acknowledged_in_person: false,
}

export default function StaffApplication() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [expired, setExpired] = useState(false)
  const draft = useFormDraft({ form: 'staff', eventCode: EVENT_CODE, userId: session?.user.id, blank })
  // The Google account they signed in with (the one the form was opened with). The
  // database records this one whatever is sent, so the field is read-only.
  const [email] = useState(session?.user.email ?? '')
  const form = { ...draft.form, email }
  const signedOut = expired || (draft.owner !== null && session?.user.id !== draft.owner)
  const { save } = draft
  useEffect(() => { if (signedOut) save() }, [signedOut, save])

  const update = <K extends keyof typeof blank>(field: K, value: (typeof blank)[K]) => draft.setForm(prev => ({ ...prev, [field]: value }))

  const isJudging = form.applicant_type === 'judge' || form.applicant_type === 'hybrid'
  const isMentoring = form.applicant_type === 'mentor' || form.applicant_type === 'hybrid'

  const bio = cleanText(form.bio)
  const bioLength = bio.length

  // Keys of incomplete fields, in the order they appear on the page.
  const missing: string[] = []
  if (!form.first_name.trim()) missing.push('first_name')
  if (!form.last_name.trim()) missing.push('last_name')
  if (!isValidEmail(form.email.trim())) missing.push('email')
  if (!isValidPhone(form.phone)) missing.push('phone')
  if (!form.organization.trim()) missing.push('organization')
  if (!form.role_title.trim()) missing.push('role_title')
  if (!isHttpsLink(form.linkedin_url.trim())) missing.push('linkedin_url')
  if (!form.ucsd_affiliation) missing.push('ucsd_affiliation')
  if (!form.applicant_type) missing.push('applicant_type')
  if (isJudging && !form.judging_track) missing.push('judging_track')
  if (form.heard_about.length === 0) missing.push('heard_about')
  if (isJudging && !form.acknowledged_in_person_judging) missing.push('acknowledged_in_person_judging')
  if (isMentoring && !form.acknowledged_onsite_mentoring) missing.push('acknowledged_onsite_mentoring')
  if (!form.acknowledged_in_person) missing.push('acknowledged_in_person')
  const isComplete = missing.length === 0
  const cls = (key: string, base = '') =>
    [base, showErrors && missing.includes(key) ? 'sp-field-error' : ''].filter(Boolean).join(' ') || undefined
  /** aria-invalid on a control whose answer is missing or wrong, once Submit has been pressed. */
  const inv = (key: string) => (showErrors && missing.includes(key) ? { 'aria-invalid': true as const } : {})

  /** The first problem, in words: the specific one where there is one. */
  const firstProblem = () => {
    const first = missing[0]
    if (first === 'phone' && form.phone) return phoneProblem(form.phone) ?? 'Enter a 10-digit phone number.'
    if (first === 'linkedin_url' && form.linkedin_url.trim()) return 'Your LinkedIn link should start with https://.'
    if (missing.length === 1 && first.startsWith('acknowledged_')) return 'Tick the box to confirm before submitting.'
    if (missing.length === 1 && first === 'heard_about') return 'Tell us how you heard about DataHacks.'
    return 'Some required answers are missing. The first one is highlighted.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isComplete) {
      setShowErrors(true)
      setError(firstProblem())
      // Focus the first problem field (no toast: on phones it covered the Submit button).
      requestAnimationFrame(() => {
        const target = document.getElementById(`field-${missing[0]}`)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const control = target?.matches('input, textarea') ? target : target?.querySelector<HTMLElement>('input, textarea, button')
        control?.focus({ preventScroll: true })
      })
      return
    }

    if (!session || signedOut) return setExpired(true)

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
    } catch (e) {
      setError(`${friendlyError(e)} Your answers are saved on this device.`)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('applications').insert({
      user_id: session.user.id,
      event_id: eventId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      first_name: cleanLine(form.first_name),
      last_name: cleanLine(form.last_name),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      applicant_type: form.applicant_type,
      organization: cleanLine(form.organization),
      role_title: cleanLine(form.role_title),
      linkedin_url: form.linkedin_url.trim(),
      ucsd_affiliation: form.ucsd_affiliation,
      judging_track: isJudging ? form.judging_track : null,
      bio: isMentoring && bioLength > 0 ? bio : null,
      heard_about: form.heard_about,
      acknowledged_in_person_judging: isJudging && form.acknowledged_in_person_judging,
      acknowledged_onsite_mentoring: isMentoring && form.acknowledged_onsite_mentoring,
      acknowledged_in_person: form.acknowledged_in_person,
    })

    setSubmitting(false)

    if (insertError) {
      if (errorKind(insertError) === 'session') return setExpired(true)
      const message = applicationErrorMessage(insertError)
      setError(insertError.code === '23505' ? message : `${message} Your answers are saved on this device.`)
      return
    }

    // "We've received your application": the server picks the application and address and
    // sends it once. Not awaited; if this tab closes first, the portal asks again on its next visit.
    void requestReceivedEmail(session.user.id)
    draft.clear()
    await queryClient.invalidateQueries({ queryKey: ['staff-application'] })
    navigate(portal.home, { replace: true, state: { justSubmitted: true } })
  }


  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Mentor / judge application</h1>
        <p>Apply to mentor, judge, or both. Every question is required except the blurb.</p>
      </header>
          <form className="sp-card sp-form" onSubmit={handleSubmit} noValidate>
            {signedOut && <SignedOutNotice as="staff" otherAccount={session && session.user.id !== draft.owner ? session.user.email ?? '' : null} onLeave={save} />}
            <p className="sp-form-note">
              <strong>In person only.</strong> Mentoring and judging happen on site at UC San Diego, with no online option, so please
              apply only if you can be there in person. As of now, we don't provide travel support or reimbursement for mentors and judges.
            </p>
            <DraftNote restoredAt={draft.restoredAt} onReset={draft.reset} />
            <ApplyWithAiNote />

            <div className="sp-form-fields">
              <label id="field-first_name" className={cls('first_name')}>First name <Req />
                <input required maxLength={MAX_LENGTH.name} value={form.first_name} onChange={e => update('first_name', e.target.value)} {...inv('first_name')} />
              </label>
              <label id="field-last_name" className={cls('last_name')}>Last name <Req />
                <input required maxLength={MAX_LENGTH.name} value={form.last_name} onChange={e => update('last_name', e.target.value)} {...inv('last_name')} />
              </label>
              <label id="field-email" className={cls('email')}>Email <Req />
                <input type="email" required readOnly value={form.email} />
              </label>
              <label id="field-phone" className={cls('phone')}>Phone number <Req />
                <PhoneInput value={form.phone} onChange={v => update('phone', v)} {...inv('phone')} />
              </label>
              <label id="field-organization" className={cls('organization')}>Company / lab you work for <Req />
                <input required maxLength={MAX_LENGTH.short} value={form.organization} onChange={e => update('organization', e.target.value)} {...inv('organization')} />
              </label>
              <label id="field-role_title" className={cls('role_title')}>Your role at your company or institute <Req />
                <input required maxLength={MAX_LENGTH.short} value={form.role_title} onChange={e => update('role_title', e.target.value)} {...inv('role_title')} />
              </label>
              <label id="field-linkedin_url" className={cls('linkedin_url')}>Link to your LinkedIn <Req />
                <input type="url" required maxLength={MAX_LENGTH.link} placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} {...inv('linkedin_url')} />
              </label>

              <fieldset id="field-ucsd_affiliation" className={cls('ucsd_affiliation')}>
                <legend>Are you a UCSD student, alum or faculty member? <Req /></legend>
                {ucsdOptions.map(option => (
                  <label className="sp-check" key={option.value} htmlFor={`ucsd_${option.value}`} style={{ marginBottom: '8px' }}>
                    <input
                      type="radio"
                      name="ucsd_affiliation"
                      id={`ucsd_${option.value}`}
                      checked={form.ucsd_affiliation === option.value}
                      onChange={() => update('ucsd_affiliation', option.value)}
                      {...inv('ucsd_affiliation')}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset id="field-applicant_type" className={cls('applicant_type')}>
                <legend>Are you willing to mentor, judge, or both? <Req /></legend>
                <p className="sp-form-note">We will be giving priority to people who sign up as both.</p>
                {applicantTypeOptions.map(option => (
                  <label className="sp-check" key={option.value} htmlFor={`type_${option.value}`} style={{ marginBottom: '8px' }}>
                    <input
                      type="radio"
                      name="applicant_type"
                      id={`type_${option.value}`}
                      checked={form.applicant_type === option.value}
                      onChange={() => update('applicant_type', option.value)}
                      {...inv('applicant_type')}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              {isJudging && (
                <fieldset id="field-judging_track" className={cls('judging_track')}>
                  <legend>Which track would you be interested in judging? (select one) <Req /></legend>
                  <p className="sp-form-note">
                    Judges from a DataHacks industry sponsor judge that sponsor's challenge. Everyone else judges one of the five tracks.
                  </p>
                  {trackOptions.map(option => (
                    <label className="sp-check" key={option.value} htmlFor={`track_${option.value}`} style={{ marginBottom: '8px' }}>
                      <input
                        type="radio"
                        name="judging_track"
                        id={`track_${option.value}`}
                        checked={form.judging_track === option.value}
                        onChange={() => update('judging_track', option.value)}
                        {...inv('judging_track')}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              {isMentoring && (
                <label id="field-bio" className={cls('bio')}>A short blurb about you <span>(optional, shown to hackers on the mentor calendar)</span>
                  <LimitedTextarea
                    rows={4}
                    maxLength={MAX_LENGTH.bio}
                    value={form.bio}
                    onChange={e => update('bio', e.target.value)}
                  />
                  {bioLength === 0 && <span>Leave it blank and we'll write one for you from your application.</span>}
                </label>
              )}

              <div id="field-heard_about" className={cls('heard_about', 'sp-field')}>
                <span id="staff-heard-label" className="sp-field-label">How did you hear about DataHacks? (select all that apply) <Req /></span>
                <MultiSelect
                  id="staff-heard"
                  options={STAFF_HEARD_ABOUT}
                  value={form.heard_about}
                  onChange={v => update('heard_about', v)}
                  aria-labelledby="staff-heard-label staff-heard"
                  {...inv('heard_about')}
                />
              </div>

              {isJudging && (
                <div id="field-acknowledged_in_person_judging" className={cls('acknowledged_in_person_judging', 'sp-check')}>
                  <input
                    type="checkbox"
                    id="in_person"
                    checked={form.acknowledged_in_person_judging}
                    onChange={e => update('acknowledged_in_person_judging', e.target.checked)}
                    {...inv('acknowledged_in_person_judging')}
                  />
                  <label htmlFor="in_person">
                    I understand that online judging is not allowed: judges must be present in person.
                  </label>
                </div>
              )}

              {isMentoring && (
                <div id="field-acknowledged_onsite_mentoring" className={cls('acknowledged_onsite_mentoring', 'sp-check')}>
                  <input
                    type="checkbox"
                    id="onsite_mentoring"
                    checked={form.acknowledged_onsite_mentoring}
                    onChange={e => update('acknowledged_onsite_mentoring', e.target.checked)}
                    {...inv('acknowledged_onsite_mentoring')}
                  />
                  <label htmlFor="onsite_mentoring">{MENTOR_ONSITE_ACKNOWLEDGEMENT}</label>
                </div>
              )}

              <div id="field-acknowledged_in_person" className={cls('acknowledged_in_person', 'sp-check')}>
                <input
                  type="checkbox"
                  id="in_person_only"
                  required
                  checked={form.acknowledged_in_person}
                  onChange={e => update('acknowledged_in_person', e.target.checked)}
                  {...inv('acknowledged_in_person')}
                />
                <label htmlFor="in_person_only">
                  I understand that mentoring and judging are strictly in person. There are no online options for either.
                </label>
              </div>
            </div>

            {error && <p className="sp-error" role="alert">{error}</p>}

            <PrivacyNotice />

            <div className="sp-form-actions">
              <button type="submit" className="sp-button primary" disabled={submitting || signedOut}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
    </div>
  )
}
