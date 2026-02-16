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
        { name: "Qualcomm", logo: "/sponsors/qualcomm.png" },
        { name: "HDSI", logo: "/sponsors/hdsi.png" },
      ],
    },
    {
      name: "Gold",
      color: "text-accent",
      cardSize: "w-60 h-36",
      sponsors: [
        { name: "Marimo", logo: "/sponsors/marimo.png" },
        { name: "Sphinx", logo: "/sponsors/sphinx.png" },
      ],
    },
    {
      name: "Silver",
      color: "text-white/70",
      cardSize: "w-52 h-32",
      sponsors: [
        { name: "Databricks", logo: "/sponsors/databricks.png" },
        { name: "Scripps", logo: "/sponsors/scripps.png" },
      ],
    },
    {
      name: "Bronze",
      color: "text-accent/70",
      cardSize: "w-44 h-28",
      sponsors: [
        { name: "The Basement", logo: "/sponsors/basement.png" },
        { name: "Data Science Alliance", logo: "/sponsors/dsa.png" },
      ],
    },
  ];

  // Partners (separate + smaller)
  const partners = [
    { name: "MongoDB", logo: "/partners/mongo.png" },
    { name: "GitHub", logo: "/partners/github.png" },
    { name: "JetBrains", logo: "/partners/jetbrains.png" },
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

        {/* Sponsor Tiers */}
        {sponsorTiers.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.08 * index }}
            className="mb-12"
          >
            <h3 className={`text-2xl text-center font-semibold mb-6 ${tier.color}`}>
              {tier.name}
            </h3>

            <div className="flex flex-wrap justify-center gap-6">
              {tier.sponsors.map((sponsor) => (
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
                  `}
                >
                  <img
                    src={sponsor.logo}
                    alt={sponsor.name}
                    className="max-h-16 object-contain"
                  />
                </motion.div>
              ))}
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
          <h3 className="text-xl text-center text-white/60 font-medium mb-4">
            Partners
          </h3>

          <div className="flex flex-wrap justify-center gap-4">
            {partners.map((partner) => (
              <motion.div
                key={partner.name}
                whileHover={{ scale: 1.05 }}
                className="
                  w-32 h-16
                  p-3
                  bg-white/80
                  backdrop-blur-sm
                  rounded-lg
                  flex items-center justify-center
                  border border-white/10
                  transition-all duration-300
                "
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-h-10 object-contain"
                />
              </motion.div>
            ))}
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