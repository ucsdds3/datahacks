import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'

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
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1>Hacker Application</h1>

      <input placeholder="First name (as on ID)" required value={form.first_name} onChange={e => update('first_name', e.target.value)} />
      <input placeholder="Last name (as on ID)" required value={form.last_name} onChange={e => update('last_name', e.target.value)} />
      <input placeholder="Gender" required value={form.gender} onChange={e => update('gender', e.target.value)} />
      <input placeholder="Race/ethnicity" required value={form.race_ethnicity} onChange={e => update('race_ethnicity', e.target.value)} />
      <input type="date" required value={form.birthdate} onChange={e => update('birthdate', e.target.value)} />
      <input placeholder="Country of residence" required value={form.country_of_residence} onChange={e => update('country_of_residence', e.target.value)} />
      <input placeholder="City of residence" required value={form.city_of_residence} onChange={e => update('city_of_residence', e.target.value)} />
      <input placeholder="Level of study" required value={form.level_of_study} onChange={e => update('level_of_study', e.target.value)} />
      <input placeholder="School" required value={form.school} onChange={e => update('school', e.target.value)} />
      <input placeholder="Major" required value={form.major} onChange={e => update('major', e.target.value)} />
      <input placeholder="Expected graduation year" required value={form.graduation_year} onChange={e => update('graduation_year', e.target.value)} />
      <input placeholder="Previous hackathon experience" required value={form.hackathon_experience} onChange={e => update('hackathon_experience', e.target.value)} />

      <label><input type="checkbox" checked={form.attended_before} onChange={e => update('attended_before', e.target.checked)} /> Attended DataHacks before</label>

      <input placeholder="LinkedIn (optional)" value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
      <input placeholder="Devpost (optional)" value={form.devpost_url} onChange={e => update('devpost_url', e.target.value)} />

      <label>Resume (required)
        <input type="file" accept=".pdf" required onChange={e => setResumeFile(e.target.files?.[0] ?? null)} />
      </label>

      <textarea placeholder="What's the project you're most proud of building?" required value={form.essay_proudest_project} onChange={e => update('essay_proudest_project', e.target.value)} />
      <textarea placeholder="What's something unique you'd bring?" required value={form.essay_unique_thing} onChange={e => update('essay_unique_thing', e.target.value)} />
      <textarea placeholder="What would you like to get out of this event?" required value={form.essay_goal} onChange={e => update('essay_goal', e.target.value)} />

      <textarea placeholder="Funniest joke (optional)" value={form.funniest_joke} onChange={e => update('funniest_joke', e.target.value)} />
      <textarea placeholder="A lifetime goal of yours (optional)" value={form.lifetime_goal} onChange={e => update('lifetime_goal', e.target.value)} />

      <label><input type="checkbox" checked={form.wants_travel_stipend} onChange={e => update('wants_travel_stipend', e.target.checked)} /> Apply for travel stipend</label>
      {form.wants_travel_stipend && (
        <>
          <textarea placeholder="How would a travel stipend help you?" value={form.travel_stipend_reason} onChange={e => update('travel_stipend_reason', e.target.value)} />
          <input placeholder="Region traveling from" value={form.travel_region} onChange={e => update('travel_region', e.target.value)} />
        </>
      )}

      <fieldset>
        <legend>How did you hear about this event?</legend>
        {heardAboutOptions.map(option => (
          <label key={option} style={{ display: 'block' }}>
            <input type="checkbox" checked={form.heard_about.includes(option)} onChange={() => toggleHeardAbout(option)} /> {option}
          </label>
        ))}
      </fieldset>

      <label>
        <input type="checkbox" required checked={form.agreed_to_terms} onChange={e => update('agreed_to_terms', e.target.checked)} />
        I agree that all info above is correct and I'll abide by the code of conduct.
      </label>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Application'}</button>
    </form>
  )
}