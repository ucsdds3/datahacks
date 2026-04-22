
# DataHacks 2027 — Hackathon Website

A minimalist, atmospheric one-page site with a parallax castle scene quietly hinting at the defense-tech theme. Stone & moss palette throughout, with elegant TBA placeholders so the structure feels intentional even before final content lands.

## Visual direction
- **Palette**: warm stone greys, parchment off-white background, deep moss-green accent, charcoal text
- **Typography**: a refined serif for headings (evoking heraldry without being literal), clean sans-serif for body
- **Background**: layered SVG parallax — distant mountains, a low castle/fortress silhouette on a hill, and faint foreground grass/mist that shift subtly as the user scrolls
- **Texture**: very subtle paper/stone grain overlay for warmth
- **Motion**: gentle fade-in-on-scroll for sections, soft hover states on cards

## Page structure (single scrolling page)

**1. Hero / Landing**
- DataHacks 2027 wordmark, with "Presented with Major League Hacking" tagline
- Live countdown timer (days · hours · minutes · seconds) — placeholder target date you can edit
- Event location: UC San Diego
- Dates line (TBD placeholder)
- Primary "Register" button → external link (placeholder URL)
- Parallax castle silhouette behind everything

**2. About / Theme tease**
- Short evocative paragraph framing the hackathon — uses words like "build", "defend", "strategy", "frontier" without saying "defense" outright
- A few key stats (hackers, hours, prize pool — all editable)

**3. Tracks**
- Grid of 3–4 track cards with TBA labels and short evocative names you can rename (e.g., "Sentinel", "Signal", "Stronghold", "Scout")

**4. Prizes**
- Tiered layout (1st / 2nd / 3rd + category prizes) as TBA cards with prize-tier styling

**5. Challenges**
- Card grid for sponsor/company challenges — all TBA

**6. Sponsors**
- Tiered logo wall (Platinum / Gold / Silver) with elegant empty placeholder slots
- "Become a sponsor" CTA → mailto link

**7. Judges**
- Card grid with silhouette avatars + "To Be Announced"

**8. Mentors**
- Same treatment as judges, separate grid

**9. FAQ**
- Accordion with ~8 standard hackathon questions (who can attend, cost, travel, what to bring, team size, beginner-friendly, code of conduct, MLH involvement)

**10. Contact**
- Email, social links (placeholders), UCSD location line
- Footer with MLH credit and copyright

## Navigation
- Sticky minimal top nav with smooth-scroll anchor links to each section, plus persistent "Register" button
- Mobile: collapses to hamburger sheet

## Technical notes
- Single route (`/`) — anchor scrolling is appropriate here since it's a marketing one-pager
- Countdown timer runs client-side from a configurable target date constant
- All content (dates, links, names, stats) lives in clearly-marked constants at the top of the page so you can edit easily
- Fully responsive

After approval I'll build the layered parallax castle SVG, wire up the countdown, and lay out all sections with the stone & moss system.
