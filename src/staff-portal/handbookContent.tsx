import type { ReactNode } from "react";

// DEMO CONTENT: the DataHacks 2026 Hacker Handbook ("Revisions_ DataHacks 26' Hacker
// Handbook.pdf"), used to try out the handbook pages. Replace with the real mentor/judge
// handbook. Reviewer margin notes, images, phone numbers, personal emails, the makerspace
// door code and credit codes from the PDF are intentionally left out.

export type HandbookSection = { id: string; title: string; content: ReactNode };

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer">{children}</a>
);

const Table = ({ head, rows }: { head: string[]; rows: string[][] }) => (
  <div className="sp-table-wrap">
    <table className="sp-table">
      <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const REG_FORM = "http://forms.gle/RHFgLkNfUF9tr1TZA";

export const HANDBOOK: HandbookSection[] = [
  {
    id: "welcome",
    title: "Welcome",
    content: <>
      <p>Thank you for joining us for DataHacks 2026, April 18–19, 2026 at UCSD's Rec Gym. This guide is your handbook for the weekend: logistics, rules, communication channels and technical resources.</p>
      <p>Questions during the event? Email <a href="mailto:datahacks@ucsd.edu">datahacks@ucsd.edu</a>, post in the <A href="https://discord.gg/z7KNvSGCvF">DataHacks Discord</A>, or find a staff member in a tan organizer shirt. There's also a help center near the stage. This guide is updated as the event approaches, so check back regularly.</p>
      <h3>Useful links</h3>
      <ul>
        <li><A href="https://datahacks.ds3ucsd.com/">DataHacks website</A></li>
        <li><A href="https://discord.gg/z7KNvSGCvF">DataHacks Discord</A></li>
        <li><A href="https://datahacks-2026.devpost.com/">DataHacks Devpost</A></li>
        <li><A href="https://www.instagram.com/datahacks_2026/">DataHacks Instagram</A></li>
        <li><A href={REG_FORM}>Team & Track Registration Form</A> (due 12:00 PM Saturday, April 18)</li>
      </ul>
      <h3>Lead organizers</h3>
      <ul>
        <li>Ansh Bhatnagar, DS3 President</li>
        <li>Praveen Sharma, DS3 Vice President of External Relations</li>
        <li>Tijil Chhabra, DataHacks Director</li>
        <li>Varick Hasim, DataHacks Director</li>
      </ul>
    </>,
  },
  {
    id: "overview",
    title: "Overview & Theme",
    content: <>
      <p>DataHacks is a 36-hour, MLH-certified hackathon bringing together 450+ students to build projects across 8 tracks: AI/ML, Data Analytics, Cloud, Hardware & IoT, Mechanical Design & Biotechnology, UI/UX & Web Development, Product & Entrepreneurship, and Economics.</p>
      <p>A unifying theme is revealed at the Opening Ceremony, and every project is expected to tie into it. We provide curated datasets, and all tracks except Hardware & IoT and Mechanical Design & Biotechnology must use at least one. The theme and datasets are kept secret in advance to keep things fair and prevent pre-planning.</p>
      <p>DataHacks runs from April 18, 8:00 AM to April 19, 7:00 PM at the <A href="https://maps.app.goo.gl/urR3t44VuhGTbGkT7">UC San Diego Recreational Gymnasium</A> (2999 Scholars Ln, La Jolla, CA 92093), right beside the Main Gym. Workshops also run in <A href="https://maps.app.goo.gl/6YtZf9prgNVkj7Ey6">Price Center Theater</A> (3135 Matthews Ln).</p>
    </>,
  },
  {
    id: "general",
    title: "General Information",
    content: <>
      <h3>Check-in</h3>
      <p>Primary check-in is 8:00–9:30 AM on April 18 at the Rec Gym, where hackers get their lanyard and DataHacks merch. The lanyard is their ticket for food and re-entry.</p>
      <ul>
        <li>UC San Diego students: latest check-in is 10:30 AM.</li>
        <li>Non-UCSD students: latest check-in is 12:00 PM.</li>
        <li>Anyone who misses check-in can't enter or compete, unless they told us in advance with documentation (e.g. flight tickets).</li>
      </ul>
      <h3>Re-entering the building</h3>
      <p>A lanyard and some form of ID are required to re-enter the venue.</p>
      <h3>Recommended packing list</h3>
      <ul>
        <li>Government AND school ID (mandatory for entry)</li>
        <li>Laptop, headphones and chargers</li>
        <li>Reusable water bottle, toiletries, deodorant</li>
        <li>A few copies of your resumé (there's a mini career fair)</li>
        <li>Travelers: sleeping bag, pillow, pajamas, sleeping mask (optional)</li>
      </ul>
      <p>We don't recommend large monitors, bulky keyboards and mice, or other accessories that take up a lot of space.</p>
      <h3>What we provide</h3>
      <ul>
        <li>Free shirts and stickers</li>
        <li>Food: Saturday breakfast, lunch and dinner; Sunday breakfast and lunch; unlimited snacks, water, energy drinks and soft drinks</li>
        <li>Workshops and activities</li>
        <li>A quiet, dark overnight sleeping room (Rec Gym Auxiliary Room)</li>
        <li>Hardware for hardware tracks (see Hacking Rules & Tracks)</li>
      </ul>
      <p>There's no shower at the venue, and no sleeping bags, blankets or pillows are provided.</p>
      <h3>Communication & internet</h3>
      <ul>
        <li>Discord is the main communication channel during the event.</li>
        <li>UCSD students, staff and affiliates can use UCSD-PROTECTED with their Active Directory login.</li>
        <li>Others can use eduroam or UCSD-Guest. See <A href="https://blink.ucsd.edu/technology/network/connections/wireless/guest.html">Using Wireless as a Guest at UC San Diego</A>.</li>
      </ul>
      <h3>Venue</h3>
      <p>Ceremonies, hacking and judging all happen in the Rec Gym. Inside there's an Auxiliary/Side Room and a Patio for workshops, activities and the career fair. Workshops also run concurrently in Price Center Theater.</p>
    </>,
  },
  {
    id: "getting-here",
    title: "Getting Here",
    content: <>
      <h3>Parking</h3>
      <p>On the weekend, a <A href="https://transportation.ucsd.edu/commute/permits/index.html#nw-night-weekend">NW Pass</A> costs $4.75 per day and covers spots marked V, S, B or A. Pay at the paystation at any lot exit or with the <A href="https://transportation.ucsd.edu/commute/permits/parkmobile.html">ParkMobile</A> app.</p>
      <p>The two closest structures:</p>
      <ul>
        <li><A href="https://maps.app.goo.gl/dYUpJw7tcpSraxmz6">8th College/Theatre District Parking Structure</A> (9135 S Scholars Dr), <A href="https://maps.app.goo.gl/mWZTh3chYc1J6DqSA">walking directions</A></li>
        <li><A href="https://maps.app.goo.gl/aHmRupbMfVgSiLZ89">Scholars Parking</A> (9655 Scholars Dr N), <A href="https://maps.app.goo.gl/p3xKiw1xDzwnejCv9">walking directions</A></li>
      </ul>
      <p>Don't park in the Gymnasium Parking Lot. It's reserved for event and venue staff, and cars there may be ticketed or towed.</p>
      <h3>Ride-sharing</h3>
      <p>Set your Uber or Lyft destination to <A href="https://maps.app.goo.gl/1H52i1ZLgVsTRuMN9">Main Gym – Muir College</A> (2995 Scholars Ln), then follow our signs from the Gymnasium lot to the Rec Gym.</p>
      <h3>Public transportation</h3>
      <p>Buses and the trolley cost about $2.50 per one-way, 2-hour trip with the <A href="https://www.sdmts.com/fares/pronto-ways-pay">PRONTO</A> app or tap-to-pay (details on the <A href="https://www.sdmts.com/">SDMTS website</A>). From the airport, take the free <A href="https://www.sdmts.com/getting-around/airport">San Diego Flyer</A> shuttle (Terminals 1 and 2, every 30 minutes) to the Old Town Transit Center, then the Blue Line trolley to UCSD Central Campus Station and walk to the Rec Gym.</p>
      <h3>FlixBus</h3>
      <p><A href="https://www.flixbus.com">FlixBus</A> stops on Campus Point Drive, just south of the UC San Diego Health La Jolla trolley station. It's about a 30-minute walk, or take the trolley to UC San Diego Main Campus station and walk 15 minutes.</p>
      <h3>Travel reimbursements</h3>
      <p>Hackers assigned a reimbursement were told the amount by email. To receive it they must submit a completed project and provide valid receipts. The team reaches out after the event to collect payment information and receipts.</p>
    </>,
  },
  {
    id: "schedule",
    title: "Schedule",
    content: <>
      <h3>Saturday, April 18, 2026</h3>
      <Table
        head={["Time", "Main Venue", "Mentorship", "Auxiliary Room", "Patio", "Price Center Theater"]}
        rows={[
          ["8:00–9:30 AM", "Check-In + Breakfast", "", "", "", ""],
          ["9:30–10:00 AM", "Opening Ceremony: Keynote from Ali Arsanjani", "", "", "", ""],
          ["10:00–10:15 AM", "Opening Ceremony: Major League Hacking + ImpulseLabs", "", "", "", ""],
          ["10:15–10:30 AM", "Opening Ceremony: Introduction", "", "", "", ""],
          ["10:30 AM–12:00 PM", "Workspace", "", "Workshop 1-1: Introduction to Arduino", "", "Workshop 2-1: Working with [X] Data + Intro to ML"],
          ["12:00–1:00 PM", "Workspace", "Mentorship Hours", "Workshop 2-2: Impulse Labs: Data to Deployed Model", "–", "Workshop 1-2: Introduction to CAD"],
          ["1:00–2:00 PM", "Lunch", "", "–", "–", "–"],
          ["2:00–3:00 PM", "Workspace", "Mentorship Hours", "Career Fair Booths", "Career Fair Booths", "Workshop 2-3: Orthogonal Workshop"],
          ["3:00–4:00 PM", "Workspace", "Mentorship Hours", "Career Fair Booths", "Career Fair Booths", "Workshop 2-4: Build with AI"],
          ["4:00–5:00 PM", "Workspace", "Mentorship Hours", "Career Fair Booths", "Career Fair Booths", "Workshop 1-4: Quantitative Intuition Behind Polymarket"],
          ["5:00–6:00 PM", "Workspace", "Mentorship Hours", "Workshop: Major League Hacking", "–", "Workshop 2-6: IoT with Arduino Uno Q"],
          ["6:00–7:00 PM", "Dinner", "", "Workshop: Major League Hacking", "–", "–"],
          ["7:00–8:00 PM", "Workspace", "", "Workshop 2-5: Product Market Fit", "", "Workshop 2-7: Where is the Alpha (Predictive Markets)?"],
          ["8:00–9:00 PM", "Workspace", "", "Workshop 1-5: Pitching a Product", "", "Workshop 2-8: Web Development"],
          ["9:00–10:00 PM", "Workspace + Poker Tournament", "", "Mario Kart Tournament + Imposter Tournament", "", "Workshop 2-9: Feature Prioritization"],
          ["10:00–11:00 PM", "Workspace + Poker Tournament", "", "Mario Kart Tournament + Imposter Tournament", "", ""],
          ["11:00 PM–12:00 AM", "Workspace + Poker Tournament", "", "Mario Kart Tournament + Imposter Tournament", "", ""],
          ["12:00–1:00 AM", "Build Your Own Ice Cream Sandwich", "", "Sleep Section", "", ""],
        ]}
      />
      <h3>Sunday, April 19, 2026</h3>
      <Table
        head={["Time", "Main Venue", "Auxiliary Room"]}
        rows={[
          ["1:00–8:00 AM", "Workspace", "Sleep Section"],
          ["8:00–9:00 AM", "Breakfast", ""],
          ["9:00 AM–12:00 PM", "Workspace + Mentorship Hours", "Workshop 2-10: Pitching Practice"],
          ["12:00 PM", "SOFT DEADLINE (initial submission)", ""],
          ["12:00–1:00 PM", "Workspace", ""],
          ["1:00 PM", "HARD DEADLINE (final submission)", ""],
          ["1:00–2:00 PM", "Lunch", ""],
          ["2:00–4:30 PM", "Judging", ""],
          ["4:30–5:15 PM", "Keynote Speech from Sharad Agarwal", ""],
          ["5:15–5:30 PM", "Speech from Nvidia", ""],
          ["5:30–7:00 PM", "Awards Ceremony", ""],
          ["7:00 PM", "End", ""],
        ]}
      />
      <h3>Workshops</h3>
      <p>Workshops are in the Auxiliary Room (inside the Rec Gym) and Price Center Theater (PCT); see the <A href="https://datahacks.ds3ucsd.com/#timeline">workshop schedule</A>. Every workshop attended earns a raffle ticket for the prize drawing at the Awards Ceremony.</p>
      <p>To get to Price Center Theater from the Rec Gym, head south on Scholars Lane, turn right onto Library Walk and continue to the theater on the second floor, about a 10-minute walk. <A href="https://maps.app.goo.gl/SH98tWQT6VFG2RbH6">Directions to PCT</A> · <A href="https://maps.app.goo.gl/Eh3gaxoByLmEVbix6">Directions back to Rec Gym</A></p>
    </>,
  },
  {
    id: "menu",
    title: "Menu",
    content: <>
      <h3>Snacks & beverages</h3>
      <ul>
        <li>Snacks: popcorn, chips, fruit, cookies, cotton candy, fruit snacks; cup noodles and ice cream after midnight</li>
        <li>Energy drinks: Monster, Celsius, Red Bull</li>
        <li>Beverages: water, Mr. Pibb, Topo Chico</li>
      </ul>
      <h3>Saturday breakfast (Einstein's Bagels)</h3>
      <ul>
        <li>Bagels: Asiago (vegan), Blueberry (vegan), Chocolate Chip, Cinnamon Raisin (vegan), Plain (vegan), Sesame (vegan)</li>
        <li>Spreads: Garden Veggie Shmear, Strawberry Shmear, Regular Plain Shmear, Peanut Butter</li>
      </ul>
      <h3>Saturday lunch (Madras Cafe)</h3>
      <ul><li>Chicken Biryani, Paneer Biryani (vegetarian), Vegetable Biryani (vegan)</li></ul>
      <h3>Saturday dinner (Regents Pizza)</h3>
      <ul><li>Cheese Pizza (vegetarian), Pepperoni Pizza</li></ul>
      <h3>Sunday breakfast (Costco)</h3>
      <ul><li>Bananas, butter croissants, Greek yogurt, granola bars, protein bars</li></ul>
      <h3>Sunday lunch (Ike's Sandwiches)</h3>
      <ul><li>Chase Ottney and Randy Hahn half-sandwiches; Michael Jordan, Kevin Bacon, Golden Bear, Marilyn and Tucknasty sandwiches; Veg News and Luther Burbank (vegan)</li></ul>
      <h3>Sunday dinner (not provided)</h3>
      <ul><li>Fundraiser at Shake Shack</li></ul>
    </>,
  },
  {
    id: "mentorship",
    title: "Mentorship",
    content: <>
      <p>Hackers who want mentorship come to mentor hours (see the <A href="https://docs.google.com/spreadsheets/d/1zB-JmXjS7GGofQtDNVhZi6nvWMLbqAOGhaBeZa55WW8/edit?usp=sharing">mentorship schedule</A>). Spots are first come, first served, and how many people can be seen depends on how long earlier arrivals stay, so hackers are asked to show up on time.</p>
    </>,
  },
  {
    id: "hacking",
    title: "Hacking Rules & Tracks",
    content: <>
      <h3>Rules</h3>
      <p>To keep the competition fair, all participants must follow these guidelines. Failure to comply may lead to disqualification.</p>
      <ul>
        <li>Participants must be students at an accredited college or university who registered before the event.</li>
        <li>Teams have at most 4 people, and each person can be on only one team.</li>
        <li>Team and project names must be appropriate for a professional environment.</li>
        <li>Projects can be submitted to up to TWO tracks.</li>
        <li>All project materials must be created during the hackathon. Reusing previous projects isn't allowed, and GitHub repos are checked.</li>
        <li>Plagiarism is strictly prohibited.</li>
        <li>Don't sabotage other teams, manipulate results or try to bypass these rules.</li>
        <li>Be respectful and kind to fellow hackers, mentors and staff. See the <A href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md">MLH Code of Conduct</A>.</li>
      </ul>
      <p>Report rule-breaking to a volunteer or at <a href="mailto:datahacks@ucsd.edu">datahacks@ucsd.edu</a>.</p>
      <h3>Teams</h3>
      <p>Teams of 1–4 must fill out the <A href={REG_FORM}>Team & Track Registration Form</A> by 12:00 PM Saturday, April 18 to be eligible to submit. The form is where teams lock in their tracks.</p>
      <h3>Domain tracks</h3>
      <p>There are 8 domain tracks, and a project can be submitted to up to two. Teams can win at most 1 Domain Track Prize and 1 Challenge Prize, though they can enter as many challenges as they like. See the <A href="https://docs.google.com/document/d/1XNavL7E6oWTiJOveEbOH5kSt_fNvt0lNWKxOKGylrWQ/edit?tab=t.0">track descriptions, judging rubrics and prizes</A>.</p>
      <h3>Required datasets</h3>
      <p>Projects in ML/AI, Data Analytics, Cloud, UI/UX & Web Development, Economics, and Product & Entrepreneurship must use at least one provided dataset as a core part of the project. This keeps projects on theme and prevents pre-planning. Datasets are revealed after the Opening Ceremony in the <A href="https://docs.google.com/document/d/1jgVPbccPBTHQiSiFLm0EgrIxyqb1jNlOwjKdaDzY57w/edit?usp=drivesdk">DataHacks 2026 Bank of Required Datasets</A>.</p>
      <h3>Provided hardware</h3>
      <p>For hardware-based tracks (teams can also bring their own):</p>
      <ul>
        <li>Sensors Kit: 1 per team, theirs to keep</li>
        <li>Qualcomm Arduino Uno Q Kit: 1 per person, must be returned. Includes the Arduino Uno Q chip, a Logitech webcam, Modulino Distance, Movement and Thermo, a USB-C multiport adapter (critical for Mac) and wiring.</li>
        <li><A href="https://drive.google.com/file/d/1lHWQE0qHh5_AS2SLeWR2JqshKVZ4R7AM/view?usp=sharing">Arduino Uno Q Setup & Troubleshooting Guide</A></li>
      </ul>
      <h3>Makerspace access</h3>
      <p>Hackers must fill out the <A href="https://forms.gle/CkRvytHBxFCz6Abo6">access form and rules</A> before entering, or they incur penalties. Competitors can work in the EnVision Makerspace (Structural and Materials Engineering (SME) Building) and the Design and Innovation Building (DIB) Makerspace, with 3D printers and hand tools provided.</p>
      <ul>
        <li><strong>DIB Makerspace</strong> (9510 Innovation Ln, near the UCSD Central Campus trolley station): open 1–6 PM Saturday, closed Sunday, UCSD students only. Hard cut-off is 7 PM. Prints started before closing keep running overnight and an organizer picks them up the next day, but long unsupervised prints aren't guaranteed to finish. Scan your student ID on entry.</li>
        <li><strong>EnVision Makerspace</strong> (SME Building, 3291 Voigt Dr): standard hours 12–4 PM Saturday (UCSD students only, with an organizer holding a DataHacks table), then reserved for DataHacks overnight with full access to hand tools and 9 Bambu Lab 3D printers. Classrooms SME 302 and 304/306 are open to competitors after 6 PM. Non-UCSD students can only use EnVision, after its open hours.</li>
        <li>3D printing uses a sign-up sheet, and G-code is reviewed before printing. Keep prints to 10 hours or less on one print bed. Longer prints need a volunteer's sign-off.</li>
        <li>Outside materials can be brought in once DataHacks starts.</li>
      </ul>
      <h3>Sponsor challenges</h3>
      <p>Sponsors run special challenges with extra prizes, which teams can win alongside tracks. See the <A href="https://docs.google.com/document/d/1XNavL7E6oWTiJOveEbOH5kSt_fNvt0lNWKxOKGylrWQ/edit?tab=t.zf9h33ydpfhg">challenge descriptions and prizes</A>.</p>
    </>,
  },
  {
    id: "submission",
    title: "Project Submission & Judging",
    content: <>
      <h3>Deadlines</h3>
      <ul>
        <li><strong>Soft deadline:</strong> April 19 at 12 PM. Teams should submit something by then to make sure Devpost works for them.</li>
        <li><strong>Hard deadline:</strong> April 19 at 1 PM. No late submissions under any circumstances.</li>
      </ul>
      <h3>Devpost requirements</h3>
      <p>To stay eligible for prizes, projects must be registered on Devpost before the deadline and include:</p>
      <ul>
        <li>Team members and team name</li>
        <li>GitHub repository link</li>
        <li>A 3-minute demo video covering the inspiration (what problem it solves), development (how it was built) and a demo. Challenge entries must say explicitly how they met the challenge (e.g. how NVIDIA Brev.dev was used).</li>
        <li>Every track and (optionally) challenge the project qualifies for</li>
      </ul>
      <h3>Judging</h3>
      <p>Each track has its own judges. A project is judged by two sets of judges, track judges and challenge judges, so presentations should speak to both.</p>
    </>,
  },
  {
    id: "more",
    title: "Prizes, Sponsors & FAQ",
    content: <>
      <ul>
        <li><A href="https://datahacks.ds3ucsd.com/#prizes">Prizes</A></li>
        <li><A href="https://datahacks.ds3ucsd.com/#sponsors">Sponsors</A></li>
        <li><A href="https://datahacks.ds3ucsd.com/#faq">FAQ</A></li>
      </ul>
    </>,
  },
  {
    id: "resources",
    title: "Free Resources",
    content: <>
      <h3>AI</h3>
      <ul>
        <li><A href="https://docs.google.com/document/d/12B6znctgvxN6HNquadLVaLlDVx6KfMv3gFg6yUcCyJ8/edit?usp=sharing">GPU, CPU and storage access (via SDSC)</A></li>
        <li><A href="https://chatgpt.com/codex/students?utm_source=handshake">$100 Codex credits</A></li>
        <li><A href="https://gemini.google/students/">6 months free Gemini</A></li>
        <li><A href="https://drive.google.com/file/d/1N5Sn7_T1annSiuzVE-JBnjq7GYwLNvbu/view?usp=sharing">Brev.dev credits (NVIDIA)</A>, required for the NVIDIA challenge (<A href="https://drive.google.com/file/d/1-uL3890jHIyBOdJ2O4P-SlMoBqmHsYf2/view?usp=sharing">setup</A>)</li>
        <li><A href="https://cursor.sh/">Cursor</A>, <A href="https://huggingface.co/">Hugging Face</A>, <A href="https://wandb.ai/site/students">Weights & Biases</A>, <A href="https://clickup.com/students">ClickUp Student Plan</A></li>
        <li><A href="https://tritonai.ucsd.edu/tritongpt/index.html">TritonGPT API</A> (free for UCSD students)</li>
      </ul>
      <h3>Cloud</h3>
      <ul>
        <li><A href="https://aws.amazon.com/free/">$200 AWS credits</A>, required for the AWS challenge</li>
        <li>$5 Google Cloud credits (don't use a .edu account), required for the GDG challenge</li>
        <li><A href="https://azure.microsoft.com/en-us/free/students/">Microsoft Azure for Students</A>, <A href="https://www.oracle.com/cloud/free/">Oracle Cloud Free Tier</A>, <A href="https://www.digitalocean.com/github-students">DigitalOcean Student Credits</A></li>
      </ul>
      <h3>Web deployment</h3>
      <ul>
        <li><A href="https://replit.com/">Replit</A>, <A href="https://vercel.com/">Vercel</A> ($30 free credits), <A href="https://www.netlify.com/">Netlify</A></li>
        <li><A href="https://education.github.com/pack">GitHub Student Developer Pack</A></li>
      </ul>
      <h3>Design</h3>
      <ul><li><A href="https://www.figma.com/education/">Figma Education</A>, <A href="https://www.canva.com/education/">Canva for Education</A>, <A href="https://spline.design/">Spline</A></li></ul>
      <h3>Databases</h3>
      <ul><li><A href="https://www.mongodb.com/students">MongoDB Student Pack</A>, <A href="https://supabase.com/">Supabase</A>, <A href="https://firebase.google.com/">Firebase</A>, <A href="https://www.jetbrains.com/academy/student-pack/">JetBrains Student Pack</A></li></ul>
      <h3>Cybersecurity</h3>
      <ul><li><A href="https://www.cloudflare.com/developer-platform/">Cloudflare</A> (CDN + Workers)</li></ul>
      <h3>Communication & note-taking</h3>
      <ul><li><A href="https://www.notion.so/product/notion-for-education">Notion Education</A>, <A href="https://slack.com/">Slack</A></li></ul>
    </>,
  },
];
