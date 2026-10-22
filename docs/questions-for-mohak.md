# Questions for you

Answer whenever. Anything unanswered uses the placeholder in brackets, and I'll swap in your answer later.

## Dates
1. **Priority applications close:** Thanksgiving, Thursday, November 26, 2026? [that date]
2. **Regular applications close:** mid- or end of December. Which day? [December 15, 2026]
3. **The hackathon:** the mentor form says Saturday, January 16. Is it January 16–17, 2027? [yes]
4. **Decisions go out when?** For example, priority decisions in early December and regular in late December. [shown as "after applications close"]

## People and roles
5. **Who are the organizers?** Give me the Google emails that should open the organizer console. Each one needs an `organizer` row in `event_roles`. One exists today, and I don't know whose it is.
6. **"Jev" and the LLM top/bottom-50% sort:** who is Jev, and is that Evan's part?
7. You mentioned "Java for the application part". What did you mean?
8. **Invited people** (sponsor engineers, professors): same mentor/judge application, or a separate, shorter form? [the same application]
9. **Mentor block on the hacker Mentors tab:** 12:30–4:30 (the run of show) or 3:30–4:30? [12:30–4:30]
10. **Can one person apply as both a hacker and a mentor?** The database allows one application per person per event. [no]

## Email
11. **Hacker liability waiver:** the same DocuSign waiver as mentors and judges? [yes]
12. **Decision emails:** do you want to write them, or should I draft accepted, waitlisted and rejected versions for you to edit? [I draft them]
13. **Gmail's daily limit** is 2,000 emails for a Workspace account and 500 for a personal Gmail. Is info@ds3.club a Workspace account? [assume Workspace]
14. **Check-in passes:** the wallet-pass and Gmail settings in `.env.local` look like an existing script. Where does it live? Should the console send check-in codes too?

## Google sign-in screen
15. Google says "continue to yrxjhrrphhbmqejresvy.supabase.co". The app name is set in the **Google Cloud project that owns the OAuth client**, not in Supabase. To find it: Supabase → Authentication → Sign In / Providers → Google shows a Client ID starting `68033749280-`. Whoever set up Google sign-in has that project in console.cloud.google.com. Who set it up?
16. What should the screen say? I'd use "DataHacks". A `datahacks.supabase.co`-style address is a paid Supabase add-on too, so it's on hold.
