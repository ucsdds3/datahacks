import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import MinecraftLayout from '@/components/MinecraftLayout'

const heardAboutOptions = ['Friend/word of mouth', 'Past DataHacks event', 'Tabling on campus', 'Social Media', 'Email newsletter', 'Other']

export default function ApplicationForm() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', gender: '', race_ethnicity: '', birthdate: '',
    country_of_residence: '', city_of_residence: '', level_of_study: '', school: '',
    major: '', graduation_year: '', hackathon_experience: '', attended_before: false,
    linkedin_url: '', devpost_url: '', essay_proudest_project: '', essay_unique_thing: '',
    essay_goal: '', funniest_joke: '', lifetime_goal: '', wants_travel_stipend: false,
    travel_stipend_reason: '', travel_region: '', heard_about: [] as string[], agreed_to_terms: false,
  })

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleHeardAbout = (option: string) => {
    setForm(prev => ({
      ...prev,
      heard_about: prev.heard_about.includes(option)
        ? prev.heard_about.filter(o => o !== option)
        : [...prev.heard_about, option],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!resumeFile) return setError('Resume is required.')
    if (!form.agreed_to_terms) return setError('You must agree to the terms.')
    if (!session) return setError('You must be signed in.')

    setSubmitting(true)

    const filePath = `${session.user.id}/${form.first_name}_${form.last_name}_resume.pdf`
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, resumeFile, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('applications').insert({
      user_id: session.user.id,
      resume_path: filePath,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      ...form,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    navigate('/dashboard/hacker')
  }

  return (
    <MinecraftLayout>
<style>{`
  .mc-form-fields > label,
  .mc-form-fields > fieldset > label {
    display: block;
    margin-bottom: 4px;
  }
  .mc-form-fields input:not([type="checkbox"]),
  .mc-form-fields textarea {
    display: block;
    width: 100%;
  }
  .mc-form-fields input[type="file"] {
    display: flex;
    align-items: center;
    height: 47px;
  }
  .mc-radio-option input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border: 1px solid #566d47;
    background: #edf0e3;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mc-radio-option input[type="checkbox"]:checked {
    background: #cedbbd;
    border-color: #627b52;
  }
`}</style>
      <div className="mc-application-page">
        <div className="mc-container" style={{ maxWidth: '700px' }}>
          <form className="mc-application-form" onSubmit={handleSubmit}>
            <div className="mc-application-preview-label">
              <span />APPLICATION
            </div>
            <h2>Hacker Application</h2>
            <p className="mc-form-disclaimer">Fields marked required must be filled out. Your resume must be a PDF.</p>

            <div className="mc-form-fields">
              <label>First name (as on ID)
                <input required value={form.first_name} onChange={e => update('first_name', e.target.value)} />
              </label>
              <label>Last name (as on ID)
                <input required value={form.last_name} onChange={e => update('last_name', e.target.value)} />
              </label>
              <label>Gender
                <input required value={form.gender} onChange={e => update('gender', e.target.value)} />
              </label>
              <label>Race/ethnicity
                <input required value={form.race_ethnicity} onChange={e => update('race_ethnicity', e.target.value)} />
              </label>
              <label>Birthdate
                <input type="date" required value={form.birthdate} onChange={e => update('birthdate', e.target.value)} />
              </label>
              <label>Country of residence
                <input required value={form.country_of_residence} onChange={e => update('country_of_residence', e.target.value)} />
              </label>
              <label>City of residence
                <input required value={form.city_of_residence} onChange={e => update('city_of_residence', e.target.value)} />
              </label>
              <label>Level of study
                <input required value={form.level_of_study} onChange={e => update('level_of_study', e.target.value)} />
              </label>
              <label>School
                <input required value={form.school} onChange={e => update('school', e.target.value)} />
              </label>
              <label>Major
                <input required value={form.major} onChange={e => update('major', e.target.value)} />
              </label>
              <label>Expected graduation year
                <input required value={form.graduation_year} onChange={e => update('graduation_year', e.target.value)} />
              </label>
              <label>Previous hackathon experience
                <input required value={form.hackathon_experience} onChange={e => update('hackathon_experience', e.target.value)} />
              </label>

              <div className="mc-radio-option">
                <input type="checkbox" id="attended_before" checked={form.attended_before} onChange={e => update('attended_before', e.target.checked)} />
                <label htmlFor="attended_before">Attended DataHacks before</label>
              </div>

              <label>LinkedIn <span>(optional)</span>
                <input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
              </label>
              <label>Devpost <span>(optional)</span>
                <input value={form.devpost_url} onChange={e => update('devpost_url', e.target.value)} />
              </label>

              <label>Resume (PDF, required)
                <input type="file" accept=".pdf" required onChange={e => setResumeFile(e.target.files?.[0] ?? null)} />
              </label>

              <label>What's the project you're most proud of building?
                <textarea required rows={4} value={form.essay_proudest_project} onChange={e => update('essay_proudest_project', e.target.value)} />
              </label>
              <label>What's something unique you'd bring?
                <textarea required rows={4} value={form.essay_unique_thing} onChange={e => update('essay_unique_thing', e.target.value)} />
              </label>
              <label>What would you like to get out of this event?
                <textarea required rows={4} value={form.essay_goal} onChange={e => update('essay_goal', e.target.value)} />
              </label>

              <label>Funniest joke <span>(optional)</span>
                <textarea rows={2} value={form.funniest_joke} onChange={e => update('funniest_joke', e.target.value)} />
              </label>
              <label>A lifetime goal of yours <span>(optional)</span>
                <textarea rows={2} value={form.lifetime_goal} onChange={e => update('lifetime_goal', e.target.value)} />
              </label>

              <div className="mc-radio-option">
                <input type="checkbox" id="travel_stipend" checked={form.wants_travel_stipend} onChange={e => update('wants_travel_stipend', e.target.checked)} />
                <label htmlFor="travel_stipend">Apply for travel stipend</label>
              </div>

              {form.wants_travel_stipend && (
                <>
                  <label>How would a travel stipend help you?
                    <textarea rows={3} value={form.travel_stipend_reason} onChange={e => update('travel_stipend_reason', e.target.value)} />
                  </label>
                  <label>Region traveling from
                    <input value={form.travel_region} onChange={e => update('travel_region', e.target.value)} />
                  </label>
                </>
              )}

              <fieldset>
                <legend>How did you hear about this event?</legend>
                {heardAboutOptions.map(option => (
                  <div className="mc-radio-option" key={option} style={{ marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      id={option}
                      checked={form.heard_about.includes(option)}
                      onChange={() => toggleHeardAbout(option)}
                    />
                    <label htmlFor={option}>{option}</label>
                  </div>
                ))}
              </fieldset>

              <div className="mc-radio-option">
                <input type="checkbox" id="agree" required checked={form.agreed_to_terms} onChange={e => update('agreed_to_terms', e.target.checked)} />
                <label htmlFor="agree">I agree that all info above is correct and I'll abide by the code of conduct.</label>
              </div>
            </div>

            {error && <p className="mc-form-disclaimer" style={{ color: '#c96b6b' }}>{error}</p>}

            <div className="mc-form-actions">
              <button type="submit" className="mc-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>

            <p className="mc-form-help">You won't be able to change your answers after submitting. Need help? Reach out to the DataHacks team.</p>
          </form>
        </div>
      </div>
    </MinecraftLayout>
  )
}