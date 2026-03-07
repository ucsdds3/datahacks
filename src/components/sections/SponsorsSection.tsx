import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const SponsorsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  // Sponsor Tiers
  const sponsorTiers = [
    {
      name: "Platinum",
      color: "text-white",
      cardSize: "w-72 h-44",
      sponsors: [
        { name: "Qualcomm", logo: "/sponsors/qualcomm.png", url: "https://www.qualcomm.com" },
        { name: "SCIDS", logo: "/sponsors/scids.png", url: "https://scids.ucsd.edu/" },
      ],
    },
    {
      name: "Gold",
      color: "text-accent",
      cardSize: "w-60 h-36",
      sponsors: [
        { name: "Marimo", logo: "/sponsors/marimo.png", url: "https://marimo.io" },
        { name: "Sphinx", logo: "/sponsors/sphinx.png", url: "https://www.sphinx.ai/" },
        { name: "COGS", logo: "/sponsors/cogs.png", url: "https://cogsci.ucsd.edu/" },
      ],
    },
    {
      name: "Silver",
      color: "text-white/70",
      cardSize: "w-52 h-32",
      sponsors: [
        { name: "Databricks", logo: "/sponsors/databricks.png", url: "https://www.databricks.com" },
        { name: "Scripps", logo: "/sponsors/scripps.png", url: "https://scripps.ucsd.edu" },
        { name: "AS", logo: "/sponsors/AS.png", url: "https://as.ucsd.edu" },
      ],
    },
    {
      name: "Bronze",
      color: "text-accent/70",
      cardSize: "w-44 h-28",
      sponsors: [
        { name: "The Basement", logo: "/sponsors/basement.png", url: "https://thebasement.ucsd.edu" },
        { name: "Data Science Alliance", logo: "/sponsors/dsa.png", url: "https://www.datasciencealliance.org" },
        { name: "Radiant Earth", logo: "/sponsors/radiant-earth.png", url: "https://radiant.earth/" },
      ],
    },
  ];

  // Partners (separate + smaller)
  const partners = [
    { name: "MongoDB", logo: "/partners/mongo.png", url: "https://www.mongodb.com" },
    { name: "JetBrains", logo: "/partners/jetbrains.png", url: "https://www.jetbrains.com" },
    { name: "GitHub", logo: "/partners/github.png", url: "https://github.com" },
    { name: "Atlassian", logo: "/partners/atlassian.png", url: "https://www.atlassian.com" },
    { name: "MLH", logo: "/partners/mlh.png", url: "https://mlh.io" },
    { name: "Pure Buttons", logo: "/partners/pure-buttons.png", url: "https://purebuttons.com" },
  ];

  return (
    <section
      id="sponsors"
      ref={ref}
      className="relative py-16 md:py-20 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(218 92% 18%) 0%, hsl(220 95% 15%) 100%)",
      }}
    >
      <div className="container mx-auto px-4 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Sponsors
          </h2>
          <p className="text-lg text-white/80 max-w-xl mx-auto">
            Thank you to our sponsors for supporting DataHacks 2026.
          </p>
        </motion.div>

        {/* Sponsor Tiers (Stacked, No Labels) */}
        {sponsorTiers.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.08 * index }}
            className="mb-10"
          >
            <div className="flex flex-wrap justify-center gap-6">
              {tier.sponsors.map((sponsor) => {
                const card = (
                  <motion.div
                    key={sponsor.name}
                    whileHover={{ scale: 1.05 }}
                    className={`
                      ${tier.cardSize}
                      p-4
                      bg-white/80
                      backdrop-blur-md
                      rounded-xl
                      flex items-center justify-center
                      border border-white/20
                      transition-all duration-300
                      ${sponsor.url ? "cursor-pointer" : ""}
                    `}
                  >
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-h-20 object-contain"
                    />
                  </motion.div>
                );

                return sponsor.url ? (
                  <a
                    key={sponsor.name}
                    href={sponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={sponsor.name}
                  >
                    {card}
                  </a>
                ) : card;
              })}
            </div>
          </motion.div>
        ))}

        {/* Partners */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-16"
        >
          <div className="flex flex-wrap justify-center gap-4">
            {partners.map((partner) => {
              const card = (
                <motion.div
                  key={partner.name}
                  whileHover={{ scale: 1.05 }}
                  className={`
                    w-32 h-16
                    p-3
                    bg-white/80
                    backdrop-blur-sm
                    rounded-lg
                    flex items-center justify-center
                    border border-white/10
                    transition-all duration-300
                    ${partner.url ? "cursor-pointer" : ""}
                  `}
                >
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-10 object-contain"
                  />
                </motion.div>
              );

              return partner.url ? (
                <a
                  key={partner.name}
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={partner.name}
                >
                  {card}
                </a>
              ) : card;
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="text-lg text-center text-white/60 mt-12"
        >
          Interested in sponsoring?{" "}
          <a href="mailto:ds3@ucsd.edu" className="text-accent hover:underline">
            Contact us
          </a>
        </motion.p>

      </div>
    </section>
  );
};

export default SponsorsSection;