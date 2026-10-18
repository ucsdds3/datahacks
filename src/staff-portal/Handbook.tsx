// Placeholder copy until the real handbook is written.
const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
const LOREM_2 =
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

const SECTIONS = [
  { id: "welcome", title: "Welcome", body: [LOREM, LOREM_2] },
  { id: "before", title: "Before the event", body: [LOREM], list: ["Lorem ipsum dolor sit amet", "Consectetur adipiscing elit", "Sed do eiusmod tempor incididunt"] },
  { id: "day-of", title: "On the day", body: [LOREM_2, LOREM] },
  { id: "helping", title: "Helping hackers", body: [LOREM], list: ["Ut enim ad minim veniam", "Quis nostrud exercitation ullamco", "Laboris nisi ut aliquip ex ea commodo"] },
  { id: "conduct", title: "Code of conduct", body: [LOREM_2] },
  { id: "faq", title: "FAQ", body: [LOREM, LOREM_2] },
];

export default function Handbook() {
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Mentor handbook</h1>
        <p>Everything you need to know before and during DataHacks.</p>
      </header>
      <div className="sp-handbook">
        <nav className="sp-toc" aria-label="Handbook sections">
          <span>On this page</span>
          {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        </nav>
        <article className="sp-card sp-prose">
          {SECTIONS.map(s => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
              {s.list && <ul>{s.list.map(item => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
