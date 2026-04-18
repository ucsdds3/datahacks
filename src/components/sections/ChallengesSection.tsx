import { motion, useInView } from "framer-motion";
import {
  Bot,
  Braces,
  Cloud,
  Coins,
  Cpu,
  Database,
  Leaf,
  Lightbulb,
  Megaphone,
  Mic,
  NotebookIcon,
  Snowflake,
  Trophy,
  Award,
  Medal,
  MicrochipIcon,
  SignalIcon,
} from "lucide-react";
import { useRef } from "react";
import Bubbles from "../animations/Bubbles";

type Placement = {
  place: "1st" | "2nd" | "3rd";
  reward: string;
};

type Challenge = {
  sponsor: string;
  title: string;
  description: string;
  totalValue: string;
  placements: Placement[];
  icon: typeof Lightbulb;
};

const PLACE_STYLES = {
  "1st": {
    icon: Trophy,
    badge: "border-sun/40 bg-sun/20 text-sun",
  },
  "2nd": {
    icon: Award,
    badge: "border-white/20 bg-white/10 text-white",
  },
  "3rd": {
    icon: Medal,
    badge: "border-coral/35 bg-coral/15 text-coral",
  },
} as const;

const challenges: Challenge[] = [
  {
    sponsor: "General Challenge",
    title: "Best Use of Scripps Data",
    description:
      "Awarded to the project that demonstrates the most thoughtful, impactful, and effective use of data, whether through analysis, modeling, visualization, or decision-making.",
    totalValue: "Up to $1,500",
    placements: [{ place: "1st", reward: "DJI Neo Drone" }, { place: "2nd", reward: "Otter LEGO Set" }, { place: "3rd", reward: "Swag Bundle" }],
    icon: Database,
  },
  {
    sponsor: "ML & AI Tooling Challenge",
    title: "Best Use of Marimo/Sphinx",
    description:
      "Develop your machine learning or data science project using Marimo notebooks and Sphinx for modeling, analysis, and documentation. Judged on clarity, reproducibility, and workflow design.",
    totalValue: "Up to $1,500",
    placements: [{ place: "1st", reward: "$200 Gift Card + Swag" }, { place: "2nd", reward: "$100 Gift Card + Swag" }, { place: "3rd", reward: "$75 Gift Card + Swag" }],
    icon: NotebookIcon,
  },
  {
    sponsor: "Data Platform Challenge",
    title: "Best Use of Databricks",
    description:
      "Leverage the Databricks platform for data processing, analytics, or machine learning workflows. Evaluated on effective use of the Databricks ecosystem.",
    totalValue: "Up to $1000",
    placements: [{ place: "1st", reward: "JBL Speaker, Air Tag + Holder, & Swag" }],
    icon: Database,
  },
  {
    sponsor: "Edge Computing Challenge",
    title: "Best Use of Edge-AI",
    description:
      "Build a project that runs intelligence at the edge using embedded devices. Projects will be judged on system design, efficiency, and real-world applicability.",
    totalValue: "Up to $1000",
    placements: [{ place: "1st", reward: "Arduino Kit, Projector, Screen, &  4K Fire Stick" }],
    icon: Cpu,
  },
  {
    sponsor: "Cloud Platform Challenge",
    title: "Best Use of AWS Services",
    description:
      "Use AWS services as part of your project's infrastructure, data pipeline, or deployment. Projects will be evaluated on meaningful and well-architected use of the AWS ecosystem.",
    totalValue: "Up to $1000",
    placements: [{ place: "1st", reward: "Record Player" }],
    icon: Cloud,
  },
  {
    sponsor: "API Platform Challenge",
    title: "Best Use of Orthogonal",
    description:
      "Use Orthogonal's API platform to build your project. Projects will be evaluated on meaningful and well-architected use of the Orthogonal ecosystem.",
    totalValue: "Up to $1000",
    placements: [{ place: "1st", reward: "Meta Ray Bans" }],
    icon: Braces,
  },
  {
    sponsor: "Cloud Platform Challenge",
    title: "Best Innovation with Google Build With AI",
    description:
      "Build and deploy your project using Google AI & GCP. Submissions will be judged on effective integration and system design.",
    totalValue: "Up to $1,000",
    placements: [{ place: "1st", reward: "Google Swag Duffle Bag" }],
    icon: Bot,
  },
  {
    sponsor: "Data Platform Challenge",
    title: "Best Models Trained on Impulse AI Platform",
    description:
      "Train and deploy ML models using Impulse's MLE agent. Projects will be judged for most creative use of Impulse AI, best models, and real world use cases.",
    totalValue: "Up to $800",
    placements: [{ place: "1st", reward: "Impulse Annual Plan, Powerbank, Sweatshirt, $25 Gift Card" }, { place: "2nd", reward: "80% off Impulse Annual Plan, Powerbank, Sweatshirt" }, { place: "3rd", reward: "80% off Impulse Annual Plan, Powerbank" }],
    icon: Bot,
  },
  {
    sponsor: "Cloud Platform Challenge",
    title: "Best Use of NVIDIA Brev.dev",
    description:
      "Use NVIDIA Brev.dev as part of your project's infrastructure, data pipeline, or deployment. Projects will be evaluated on meaningful and well-architected use of the NVIDIA Brev.dev ecosystem.",
    totalValue: "Up to $500",
    placements: [{ place: "1st", reward: "Sennheiser Headphones, & Charging Dock" }],
    icon: Cloud,
  },
  {
    sponsor: "Analytics Challenge",
    title: "Best Solution for ZenPower",
    description:
      "Build a project that provides the best solution for ZenPower, a company focused on energy management and sustainability. Projects should demonstrate innovative approaches to solar customer acquisition, optimizing energy usage, reducing waste, or promoting renewable energy solutions.",
    totalValue: "Up to $500",
    placements: [{ place: "1st", reward: "$125 Gift Cards" }],
    icon: Leaf,
  },
  {
    sponsor: "IEEE Consumer Technology Society",
    title: "Best Alignment with Mission of IEEE Consumer Technology",
    description:
      "Build a project that enhances the user experience through innovative consumer electronics or smart home integration. Projects will be judged on human-centric design, usability, and the ability to bring sophisticated technology into everyday life to solve modern challenges.",
    totalValue: "$500",
    placements: [
      { place: "1st", reward: "$125 Amazon Gift Card" },
    ],
    icon: MicrochipIcon,
  },
  {
    sponsor: "IEEE Information Theory Society",
    title: "Best Alignment with Mission of IEEE Information Theory",
    description:
      "Awarded to the project that demonstrates mastery over data transmission, compression, or processing. Whether optimizing network efficiency, implementing advanced error correction, or extracting signal from noise, judges will evaluate how effectively information is quantified and communicated within the system.",
    totalValue: "$500",
    placements: [
      { place: "1st", reward: "$125 Amazon Gift Card" },
    ],
    icon: SignalIcon,
  },
  {
    sponsor: "Entrepreneurship Challenge",
    title: "Most Innovative Idea",
    description:
      "Awarded to the project that demonstrates the most innovative and creative idea, regardless of technical complexity. Judges will look for originality, potential impact, and visionary thinking.",
    totalValue: "Up to $200",
    placements: [{ place: "1st", reward: "$25 Gift Card + Swag" }, { place: "2nd", reward: "$25 Gift Card" }, { place: "3rd", reward: "Swag" }],
    icon: Lightbulb,
  },
  {
    sponsor: "Entrepreneurship Challenge",
    title: "Most Viral Idea",
    description:
      "Awarded to the project that generates the most buzz and excitement among attendees, as measured by social media engagement, peer voting, or other forms of recognition. Judges will look for projects that capture attention and inspire others.",
    totalValue: "Up to $300",
    placements: [{ place: "1st", reward: "JBL Speaker + Escape Game Tickets!" }],
    icon: Megaphone,
  },
  {
    sponsor: "MLH Challenge",
    title: "Best Use of Gemini API",
    description:
      "Build an AI-powered application using the Gemini API and Google Cloud. Projects should showcase meaningful use of language understanding, generation, or reasoning to solve real-world problems.",
    totalValue: "Swag",
    placements: [{ place: "1st", reward: "Swag Kits" }],
    icon: Bot,
  },
  {
    sponsor: "MLH Challenge",
    title: "Best Use of ElevenLabs",
    description:
      "Create an application using ElevenLabs to generate realistic, expressive AI audio. Projects can include voice agents, narration systems, or interactive audio experiences.",
    totalValue: "Prize",
    placements: [{ place: "1st", reward: "Wireless Earbuds" }],
    icon: Mic,
  },
  {
    sponsor: "MLH Challenge",
    title: "Best Use of Solana",
    description:
      "Build a fast, scalable application using the Solana blockchain. Projects may include decentralized apps, payments, trading systems, or high-throughput consumer products.",
    totalValue: "Prize",
    placements: [{ place: "1st", reward: "Ledger Nano S Plus" }],
    icon: Coins,
  },
  {
    sponsor: "MLH Challenge",
    title: "Best Use of DigitalOcean",
    description:
      "Deploy or scale your project using DigitalOcean infrastructure such as Droplets, Managed Databases, or App Platform. Judged on effective cloud architecture and usage.",
    totalValue: "Prize",
    placements: [{ place: "1st", reward: "Retro Wireless Mouse" }],
    icon: Cloud,
  },
  {
    sponsor: "MLH Challenge",
    title: "Best Use of Snowflake API",
    description:
      "Build an application using Snowflake's APIs for data processing or AI-powered workflows. Projects should demonstrate efficient data handling and integration of AI capabilities.",
    totalValue: "Prize",
    placements: [{ place: "1st", reward: "Raspberry Pi 4" }],
    icon: Snowflake,
  },
];

const ChallengesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="challenges"
      ref={ref}
      className="relative overflow-hidden py-24 md:py-32"
      style={{
        background: "linear-gradient(180deg, hsl(215 90% 22%) 0%, hsl(218 92% 18%) 100%)",
      }}
    >
      <Bubbles count={8} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-bioluminescent"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-6 font-display text-4xl font-bold text-white md:text-5xl">
            Sponsor Challenges
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-white/80">
            Take on special challenges from our sponsors for additional prizes and recognition. Note that prizes are
            not cash prizes and will be items worth approximately the listed value.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {challenges.map((challenge, index) => (
            <motion.div
              key={`${challenge.sponsor}-${challenge.title}-${index}`}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              whileHover={{ y: -10 }}
              className="group relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-bioluminescent/10 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
              <div className="relative flex h-full flex-col rounded-2xl border border-bioluminescent/20 bg-deep-water/50 p-8 backdrop-blur-md">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-sm font-medium text-bioluminescent">{challenge.sponsor}</div>
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                    {challenge.totalValue}
                  </span>
                </div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-bioluminescent/20">
                  <challenge.icon className="h-6 w-6 text-bioluminescent" />
                </div>
                <h3 className="mb-3 font-display text-xl font-bold text-white">{challenge.title}</h3>
                <p className="flex-grow leading-relaxed text-white/70">{challenge.description}</p>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <div className="space-y-2.5">
                    {challenge.placements.map((placement) => {
                      const Icon = PLACE_STYLES[placement.place].icon;
                      return (
                        <div
                          key={`${challenge.title}-${placement.place}`}
                          className="flex items-start justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5"
                        >
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${PLACE_STYLES[placement.place].badge}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {placement.place}
                          </span>
                          <span className="text-right font-display text-base font-bold text-accent">
                            {placement.reward}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ChallengesSection;
