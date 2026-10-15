import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import MinecraftLayout from '@/components/MinecraftLayout'

type ApplicantType = 'mentor' | 'judge' | 'both'

const applicantTypeOptions: { value: ApplicantType; label: string }[] = [
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
  { value: 'both', label: 'Both (priority preference)' },
]

const ucsdOptions = [
  { value: 'student', label: 'UCSD Student' },
  { value: 'alumni', label: 'UCSD Alumni' },
  { value: 'faculty', label: 'UCSD Faculty Member' },
  { value: 'none', label: 'Not Affiliated With UCSD' },
]

const trackOptions = [
  { value: 'social_good_wellbeing', label: 'Social Good & Wellbeing' },
  { value: 'healthcare_health_tech', label: 'Healthcare / Health Technology' },
  { value: 'defense_cybersecurity', label: 'Defense & Cybersecurity' },
  { value: 'fintech_econ_finance', label: 'FinTech / Economy / Finance' },
  { value: 'entertainment', label: 'Entertainment' },
]

const BIO_MIN_LENGTH = 100
const BIO_MAX_LENGTH = 500

const isValidUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export default function MentorJudgeApplication() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    organization: '',
    role_title: '',
    resume_url: '',
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

  const isJudging = form.applicant_type === 'judge' || form.applicant_type === 'both'
  const isMentoring = form.applicant_type === 'mentor' || form.applicant_type === 'both'

  const bioLength = form.bio.trim().length

  const missing: string[] = []
  if (!form.first_name.trim()) missing.push('First name')
  if (!form.last_name.trim()) missing.push('Last name')
  if (!isValidEmail(form.email.trim())) missing.push('A valid email')
  if (!form.organization.trim()) missing.push('Company / lab')
  if (!form.role_title.trim()) missing.push('Your role')
  if (!isValidUrl(form.resume_url.trim())) missing.push('A valid resume link')
  if (!isValidUrl(form.linkedin_url.trim())) missing.push('A valid LinkedIn link')
  if (!form.ucsd_affiliation) missing.push('UCSD affiliation')
  if (!form.applicant_type) missing.push('Mentor, judge, or both')
  if (isJudging && !form.judging_track) missing.push('Judging track')
  if (isJudging && !form.acknowledged_in_person_judging) missing.push('In-person judging checkbox')
  if (isMentoring && (bioLength < BIO_MIN_LENGTH || bioLength > BIO_MAX_LENGTH)) missing.push(`Blurb (${BIO_MIN_LENGTH}-${BIO_MAX_LENGTH} characters)`)
  if (isMentoring && !form.acknowledged_onsite_mentoring) missing.push('Onsite mentoring checkbox')
  if (!form.acknowledged_both_priority) missing.push('Priority preference checkbox')
  const isComplete = missing.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isComplete) {
      setError('All fields are required for submission.')
      toast.error('Please complete all fields before submitting.', {
        description: `Still needed: ${missing.join(', ')}.`,
      })
      return
    }

    setSubmitting(true)

    const { error: insertError } = await supabase.from('mentor_judge_applications').insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      applicant_type: form.applicant_type,
      organization: form.organization.trim(),
      role_title: form.role_title.trim(),
      resume_url: form.resume_url.trim(),
      linkedin_url: form.linkedin_url.trim(),
      ucsd_affiliation: form.ucsd_affiliation,
      judging_track: isJudging ? form.judging_track : null,
      bio: isMentoring ? form.bio.trim() : null,
      acknowledged_in_person_judging: isJudging && form.acknowledged_in_person_judging,
      acknowledged_onsite_mentoring: isMentoring && form.acknowledged_onsite_mentoring,
      acknowledged_both_priority: form.acknowledged_both_priority,
    })

    setSubmitting(false)

    if (insertError) {
      // 23505 = unique violation on lower(email)
      setError(insertError.code === '23505'
        ? 'An application with this email has already been submitted.'
        : insertError.message)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <MinecraftLayout>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="mc-application-form" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <h2>Application received</h2>
            <p className="mc-form-disclaimer">Thanks, {form.first_name}! We'll reach out at {form.email.trim()}.</p>
          </div>
        </div>
      </MinecraftLayout>
    )
  }

  return (
    <MinecraftLayout>
      <style>{`
        .mc-form-fields > label,
        .mc-form-fields > fieldset > label {
          display: block;
          margin-bottom: 4px;
        }
        .mc-form-fields input:not([type="checkbox"]):not([type="radio"]),
        .mc-form-fields textarea {
          display: block;
          width: 100%;
        }
        .mc-radio-option input[type="checkbox"],
        .mc-radio-option input[type="radio"] {
          appearance: none;
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border: 1px solid #566d47;
          background: #edf0e3;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mc-radio-option input[type="radio"] { border-radius: 50%; }
        .mc-radio-option input[type="checkbox"]:checked,
        .mc-radio-option input[type="radio"]:checked {
          background: #cedbbd;
          border-color: #627b52;
        }
      `}</style>
      <div className="mc-application-page">
        <div className="mc-container" style={{ maxWidth: '700px' }}>
          <form className="mc-application-form" onSubmit={handleSubmit} noValidate>
            <div className="mc-application-preview-label">
              <span />APPLICATION
            </div>
            <h2>Mentor / Judge Application</h2>
            <p className="mc-form-disclaimer" style={{ fontWeight: 'bold' }}>
              All fields are required for submission.
            </p>
            <p className="mc-form-disclaimer">
              Apply to mentor, judge, or both. We will be giving priority to people who sign up as both.
            </p>

            <div className="mc-form-fields">
              <label>First name
                <input required value={form.first_name} onChange={e => update('first_name', e.target.value)} />
              </label>
              <label>Last name
                <input required value={form.last_name} onChange={e => update('last_name', e.target.value)} />
              </label>
              <label>Email
                <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} />
              </label>
              <label>Company / lab you work for
                <input required value={form.organization} onChange={e => update('organization', e.target.value)} />
              </label>
              <label>Your role at your company or institute
                <input required value={form.role_title} onChange={e => update('role_title', e.target.value)} />
              </label>
              <label>Link to your resume
                <input type="url" required placeholder="https://" value={form.resume_url} onChange={e => update('resume_url', e.target.value)} />
              </label>
              <label>Link to your LinkedIn
                <input type="url" required placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
              </label>

              <fieldset>
                <legend>Are You A UCSD Student, Alumni, Or Faculty Member?</legend>
                {ucsdOptions.map(option => (
                  <div className="mc-radio-option" key={option.value} style={{ marginBottom: '8px' }}>
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

              <fieldset>
                <legend>Are you willing to mentor, judge, or both?</legend>
                <p className="mc-form-disclaimer">We will be giving priority to people who sign up as both.</p>
                {applicantTypeOptions.map(option => (
                  <div className="mc-radio-option" key={option.value} style={{ marginBottom: '8px' }}>
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
                <fieldset>
                  <legend>Which track would you be interested in judging? (select one)</legend>
                  {trackOptions.map(option => (
                    <div className="mc-radio-option" key={option.value} style={{ marginBottom: '8px' }}>
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
                <label>A short blurb about you <span>(shown to hackers on the mentor calendar)</span>
                  <textarea
                    required
                    rows={4}
                    minLength={BIO_MIN_LENGTH}
                    maxLength={BIO_MAX_LENGTH}
                    value={form.bio}
                    onChange={e => update('bio', e.target.value)}
                  />
                  <span>{bioLength}/{BIO_MAX_LENGTH} characters (minimum {BIO_MIN_LENGTH})</span>
                </label>
              )}

              {isJudging && (
                <div className="mc-radio-option">
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
                <div className="mc-radio-option">
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

              <div className="mc-radio-option">
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

            {error && <p className="mc-form-disclaimer" style={{ color: '#c96b6b' }}>{error}</p>}

            <div className="mc-form-actions">
              <button type="submit" className="mc-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MinecraftLayout>
  )
}
