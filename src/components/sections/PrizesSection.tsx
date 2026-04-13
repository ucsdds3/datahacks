import { motion, useInView } from "framer-motion";
import { Award, Gift, Medal, Sparkles, Trophy } from "lucide-react";
import { useRef } from "react";

const TRACK_PRIZES = [
  {
    track: "AI/ML",
    totalValue: "$5,000",
    accent: "from-sky-300 via-cyan-200 to-blue-100",
    prizes: [
      { place: "1st", reward: "Mac Mini" },
      { place: "2nd", reward: "Apple Watch SE 3" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
  {
    track: "Data Analytics",
    totalValue: "$2,000",
    accent: "from-emerald-300 via-teal-200 to-lime-100",
    prizes: [
      { place: "1st", reward: "Nintendo Switch + Mario Kart 8" },
      { place: "2nd", reward: "43'' 4K UHD Smart TV" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
  {
    track: "Cloud",
    totalValue: "$2,000",
    accent: "from-cyan-300 via-sky-200 to-indigo-100",
    prizes: [
      { place: "1st", reward: "Meta Quest 3S" },
      { place: "2nd", reward: "Apple TV 4K" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
  {
    track: "Mechanical Design & Biotechnology",
    totalValue: "$2,000",
    accent: "from-lime-300 via-green-200 to-emerald-100",
    prizes: [
      { place: "1st", reward: "Arduino Kit + 3D Printer with Filament" },
      { place: "2nd", reward: "Arduino Kit + Tool Kit" },
      { place: "3rd", reward: "Arduino Kit + Swag Bundle" },
    ],
  },
  {
    track: "Entrepreneurship & Product",
    totalValue: "$2,500",
    accent: "from-pink-300 via-rose-200 to-orange-100",
    prizes: [
      { place: "1st", reward: "iPad Wi-Fi 128GB A16 + Apple Pencil" },
      { place: "2nd", reward: "LOOI AI Companion Robot" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
  {
    track: "Economics",
    totalValue: "$2,000",
    accent: "from-amber-300 via-yellow-200 to-orange-100",
    prizes: [
      { place: "1st", reward: "Meta Ray-Bans + ? Trip" },
      { place: "2nd", reward: "Sony Headphones" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
  {
    track: "Hardware + IoT",
    totalValue: "$2,000",
    accent: "from-orange-300 via-amber-200 to-red-100",
    prizes: [
      { place: "1st", reward: "Arduino Kit + AirPods Pro 3" },
      { place: "2nd", reward: "Arduino Kit + Aqara Presence Sensor + Apple HomePod mini" },
      { place: "3rd", reward: "Arduino Kit + Swag Bundle" },
    ],
  },
  {
    track: "UI/UX Design + Web Development",
    totalValue: "$2,000",
    accent: "from-violet-300 via-fuchsia-200 to-pink-100",
    prizes: [
      { place: "1st", reward: 'Acer Nitro 32" 1080p Monitor + Drawing Tablet' },
      { place: "2nd", reward: "Coffee Machine + Fair-Trade Coffee" },
      { place: "3rd", reward: "Swag Bundle" },
    ],
  },
];

const PLACE_STYLES = {
  "1st": {
    icon: Trophy,
    labelClass: "bg-sun/20 text-sun border-sun/40",
  },
  "2nd": {
    icon: Award,
    labelClass: "bg-white/15 text-white border-white/20",
  },
  "3rd": {
    icon: Medal,
    labelClass: "bg-coral/15 text-coral border-coral/35",
  },
} as const;

const PrizesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="prizes"
      ref={ref}
      className="relative overflow-hidden py-24 md:py-32"
      style={{
        background: "linear-gradient(180deg, hsl(210 88% 30%) 0%, hsl(215 90% 22%) 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[-8rem] top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-sun/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-72 w-72 rounded-full bg-coral/15 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-4xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Track Awards
          </div>
          <h2 className="mb-5 font-display text-4xl font-bold text-white md:text-5xl">
            $25,000+ in Prizes
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-white/80">
            Awards are given within each domain track, so every track has its own 1st, 2nd, and 3rd place winners.
            Pick the track that best fits your project and compete there. Teams of less than 4 will recieve corresponding units of each prize.
          </p>
        </motion.div>


        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TRACK_PRIZES.map((track, index) => (
            <motion.div
              key={track.track}
              initial={{ opacity: 0, y: 32, scale: 0.98 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.45, delay: 0.08 * index }}
              className="group relative"
            >
              <div className={`absolute inset-0 rounded-[1.6rem] bg-gradient-to-br ${track.accent} opacity-10 blur-xl transition-opacity group-hover:opacity-20`} />
              <div className="relative flex h-full flex-col rounded-[1.6rem] border border-white/10 bg-deep-water/35 p-5 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-bold leading-snug text-white">
                    {track.track}
                  </h3>
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                    {track.totalValue}
                  </span>
                </div>

                <div className="space-y-3">
                  {track.prizes.map((prize) => {
                    const Icon = PLACE_STYLES[prize.place].icon;

                    return (
                      <div
                        key={`${track.track}-${prize.place}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3.5"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${PLACE_STYLES[prize.place].labelClass}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {prize.place}
                          </span>
                          <Gift className="h-4 w-4 text-white/35" />
                        </div>
                        <p className="text-sm leading-relaxed text-white/80">
                          {prize.reward}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PrizesSection;
