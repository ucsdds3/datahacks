import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { portal } from '@/portal/paths'
import { currentEventId } from '@/portal/event'
import { PhoneInput, Req, isValidPhone } from './formFields'

type ApplicantType = 'mentor' | 'judge' | 'hybrid'

const applicantTypeOptions: { value: ApplicantType; label: string }[] = [
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
  { value: 'hybrid', label: 'Both (priority preference)' },
]

const ucsdOptions = [
  { value: 'student', label: 'UCSD Student' },
  { value: 'alumni', label: 'UCSD Alumni' },
  { value: 'faculty', label: 'UCSD Faculty Member' },
  { value: 'none', label: 'Not Affiliated with UCSD' },
]

const trackOptions = [
  { value: 'social_good_wellbeing', label: 'Social Good & Wellbeing' },
  { value: 'healthcare_health_tech', label: 'Healthcare / Health Technology' },
  { value: 'defense_cybersecurity', label: 'Defense & Cybersecurity' },
  { value: 'fintech_econ_finance', label: 'FinTech / Economy / Finance' },
  { value: 'entertainment', label: 'Entertainment' },
]

/** The blurb is optional; when given it needs some substance. Blank ones get written for them. */
const BIO_MIN_LENGTH = 50

const isValidUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export default function StaffApplication() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    // The Google account they signed in with. The database records this one
    // whatever is sent, so the field is read-only.
    email: session?.user.email ?? '',
    phone: '',
    organization: '',
    role_title: '',
    linkedin_url: '',
    ucsd_affiliation: '',
    applicant_type: '' as ApplicantType | '',
    judging_track: '',
    bio: '',
    acknowledged_in_person_judging: false,
    acknowledged_onsite_mentoring: false,
    acknowledged_both_priority: false,
  })

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }))

  const isJudging = form.applicant_type === 'judge' || form.applicant_type === 'hybrid'
  const isMentoring = form.applicant_type === 'mentor' || form.applicant_type === 'hybrid'

  const bioLength = form.bio.trim().length

  // Keys of incomplete fields, in the order they appear on the page.
  const missing: string[] = []
  if (!form.first_name.trim()) missing.push('first_name')
  if (!form.last_name.trim()) missing.push('last_name')
  if (!isValidEmail(form.email.trim())) missing.push('email')
  if (!isValidPhone(form.phone)) missing.push('phone')
  if (!form.organization.trim()) missing.push('organization')
  if (!form.role_title.trim()) missing.push('role_title')
  if (!isValidUrl(form.linkedin_url.trim())) missing.push('linkedin_url')
  if (!form.ucsd_affiliation) missing.push('ucsd_affiliation')
  if (!form.applicant_type) missing.push('applicant_type')
  if (isJudging && !form.judging_track) missing.push('judging_track')
  if (isMentoring && bioLength > 0 && bioLength < BIO_MIN_LENGTH) missing.push('bio')
  if (isJudging && !form.acknowledged_in_person_judging) missing.push('acknowledged_in_person_judging')
  if (isMentoring && !form.acknowledged_onsite_mentoring) missing.push('acknowledged_onsite_mentoring')
  if (!form.acknowledged_both_priority) missing.push('acknowledged_both_priority')
  const isComplete = missing.length === 0
  const cls = (key: string, base = '') =>
    [base, showErrors && missing.includes(key) ? 'sp-field-error' : ''].filter(Boolean).join(' ') || undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isComplete) {
      setShowErrors(true)
      setError('All fields are required for submission.')
      toast.error('Please complete all fields before submitting.')
      requestAnimationFrame(() => {
        const target = document.getElementById(`field-${missing[0]}`)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true })
      })
      return
    }

    if (!session) return

    setSubmitting(true)

    let eventId: string
    try {
      eventId = await currentEventId()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('applications').insert({
      user_id: session.user.id,
      event_id: eventId,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      applicant_type: form.applicant_type,
      organization: form.organization.trim(),
      role_title: form.role_title.trim(),
      linkedin_url: form.linkedin_url.trim(),
      ucsd_affiliation: form.ucsd_affiliation,
      judging_track: isJudging ? form.judging_track : null,
      bio: isMentoring && bioLength > 0 ? form.bio.trim() : null,
      acknowledged_in_person_judging: isJudging && form.acknowledged_in_person_judging,
      acknowledged_onsite_mentoring: isMentoring && form.acknowledged_onsite_mentoring,
      acknowledged_both_priority: form.acknowledged_both_priority,
    })

    setSubmitting(false)

    if (insertError) {
      // 23505 = unique violation: one application per account per event
      setError(insertError.code === '23505'
        ? "You've already applied. Your status is on the portal's Status page."
        : insertError.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['staff-application'] })
    navigate(portal.home, { replace: true })
  }


  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Mentor / judge application</h1>
        <p>Apply to mentor, judge, or both. We will be giving priority to people who sign up as both. All fields are required.</p>
      </header>
          <form className="sp-card sp-form" onSubmit={handleSubmit} noValidate>

            <div className="sp-form-fields">
              <label id="field-first_name" className={cls('first_name')}>First name <Req />
                <input required value={form.first_name} onChange={e => update('first_name', e.target.value)} />
              </label>
              <label id="field-last_name" className={cls('last_name')}>Last name <Req />
                <input required value={form.last_name} onChange={e => update('last_name', e.target.value)} />
              </label>
              <label id="field-email" className={cls('email')}>Email <Req />
                <input type="email" required readOnly value={form.email} />
              </label>
              <label id="field-phone" className={cls('phone')}>Phone number <Req />
                <PhoneInput value={form.phone} onChange={v => update('phone', v)} />
              </label>
              <label id="field-organization" className={cls('organization')}>Company / lab you work for <Req />
                <input required value={form.organization} onChange={e => update('organization', e.target.value)} />
              </label>
              <label id="field-role_title" className={cls('role_title')}>Your role at your company or institute <Req />
                <input required value={form.role_title} onChange={e => update('role_title', e.target.value)} />
              </label>
              <label id="field-linkedin_url" className={cls('linkedin_url')}>Link to your LinkedIn <Req />
                <input type="url" required placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
              </label>

              <fieldset id="field-ucsd_affiliation" className={cls('ucsd_affiliation')}>
                <legend>Are You A UCSD Student, Alumni, Or Faculty Member? <Req /></legend>
                {ucsdOptions.map(option => (
                  <div className="sp-check" key={option.value} style={{ marginBottom: '8px' }}>
                    <input
                      type="radio"
                      name="ucsd_affiliation"
                      id={`ucsd_${option.value}`}
                      checked={form.ucsd_affiliation === option.value}
                      onChange={() => update('ucsd_affiliation', option.value)}
                    />
                    <label htmlFor={`ucsd_${option.value}`}>{option.label}</label>
                  </div>
                ))}
              </fieldset>

              <fieldset id="field-applicant_type" className={cls('applicant_type')}>
                <legend>Are you willing to mentor, judge, or both? <Req /></legend>
                <p className="sp-form-note">We will be giving priority to people who sign up as both.</p>
                {applicantTypeOptions.map(option => (
                  <div className="sp-check" key={option.value} style={{ marginBottom: '8px' }}>
                    <input
                      type="radio"
                      name="applicant_type"
                      id={`type_${option.value}`}
                      checked={form.applicant_type === option.value}
                      onChange={() => update('applicant_type', option.value)}
                    />
                    <label htmlFor={`type_${option.value}`}>{option.label}</label>
                  </div>
                ))}
              </fieldset>

              {isJudging && (
                <fieldset id="field-judging_track" className={cls('judging_track')}>
                  <legend>Which track would you be interested in judging? (select one) <Req /></legend>
                  {trackOptions.map(option => (
                    <div className="sp-check" key={option.value} style={{ marginBottom: '8px' }}>
                      <input
                        type="radio"
                        name="judging_track"
                        id={`track_${option.value}`}
                        checked={form.judging_track === option.value}
                        onChange={() => update('judging_track', option.value)}
                      />
                      <label htmlFor={`track_${option.value}`}>{option.label}</label>
                    </div>
                  ))}
                </fieldset>
              )}

              {isMentoring && (
                <label id="field-bio" className={cls('bio')}>A short blurb about you <span>(optional, shown to hackers on the mentor calendar)</span>
                  <textarea
                    rows={4}
                    minLength={BIO_MIN_LENGTH}
                    value={form.bio}
                    onChange={e => update('bio', e.target.value)}
                  />
                  <span>
                    {bioLength > 0 ? `${bioLength} characters (at least ${BIO_MIN_LENGTH})` : "Leave it blank and we'll write one for you from your application."}
                  </span>
                </label>
              )}

              {isJudging && (
                <div id="field-acknowledged_in_person_judging" className={cls('acknowledged_in_person_judging', 'sp-check')}>
                  <input
                    type="checkbox"
                    id="in_person"
                    checked={form.acknowledged_in_person_judging}
                    onChange={e => update('acknowledged_in_person_judging', e.target.checked)}
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
                  />
                  <label htmlFor="onsite_mentoring">
                    I understand that mentors must be onsite from 12:30–3:30 PM on Saturday, January 16th, with check-in starting at 11:30 AM.
                  </label>
                </div>
              )}

              <div id="field-acknowledged_both_priority" className={cls('acknowledged_both_priority', 'sp-check')}>
                <input
                  type="checkbox"
                  id="both_priority"
                  required
                  checked={form.acknowledged_both_priority}
                  onChange={e => update('acknowledged_both_priority', e.target.checked)}
                />
                <label htmlFor="both_priority">
                  I understand that applicants both mentoring and judging will be given priority preference.
                </label>
              </div>
            </div>

            {error && <p className="sp-form-note" style={{ color: '#c96b6b' }}>{error}</p>}

            <div className="sp-form-actions">
              <button type="submit" className="sp-button primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
    </div>
  )
}
