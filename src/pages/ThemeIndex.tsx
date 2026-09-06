import { Link } from "react-router-dom";

const THEMES = [
  {
    path: "/",
    name: "Cosmic Groove",
    blurb: "70s psychedelic. Rainbow ribbons, doodle field, expressive display type.",
    swatch: ["#16110E", "#F3E7D3", "#E8523F", "#F5C13D", "#7FBF8A", "#6FA8DC"],
    fg: "#F3E7D3",
    bg: "#16110E",
  },
  {
    path: "/pop",
    name: "Pop Machine",
    blurb: "Hard colour bands. Isometric toy machines, tiny humans, flat bordered cards.",
    swatch: ["#EFA0DE", "#F0BE3D", "#F26522", "#000000", "#FFF8EC", "#4FB3A5"],
    fg: "#000000",
    bg: "#EFA0DE",
  },
  {
    path: "/press",
    name: "Field Guide",
    blurb: "Retro editorial. Magazine grid, serif + condensed caps, engraved plates.",
    swatch: ["#F5E9C8", "#C8342B", "#F2C230", "#3E7A45", "#141210", "#B08D5F"],
    fg: "#F5E9C8",
    bg: "#C8342B",
  },
];

export default function ThemeIndex() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16 md:px-12 md:py-24 font-sans">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          DS3 · internal · design selection
        </p>
        <h1 className="mt-4 text-4xl md:text-6xl font-black tracking-tight">
          DataHacks 2.0 — theme mockups
        </h1>
        <p className="mt-4 max-w-xl text-neutral-400 leading-relaxed">
          Three complete directions for the January 16–17, 2027 site. Same content model, same
          Datasaur, three different design systems. Pick one.
        </p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <Link
              key={t.path}
              to={t.path}
              className="group block rounded-lg overflow-hidden border border-neutral-800 transition hover:border-neutral-500 hover:-translate-y-1 duration-300"
            >
              <div
                className="h-40 flex items-end p-5"
                style={{ background: t.bg, color: t.fg }}
              >
                <span className="text-2xl font-black tracking-tight">{t.name}</span>
              </div>
              <div className="p-5 bg-neutral-900">
                <div className="flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-5 w-5 rounded-full border border-black/40"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400">{t.blurb}</p>
                <p className="mt-4 text-sm font-medium text-neutral-200 group-hover:underline">
                  View {t.name} →
                </p>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-16 text-xs text-neutral-600">
          Old 2026 holding page still available at <Link to="/legacy" className="underline">/legacy</Link>.
        </p>
      </div>
    </div>
  );
}
