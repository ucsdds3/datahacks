import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import Bubbles from "../animations/Bubbles";

const AboutSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const organizers = {
    primary: [
      { name: "Data Science Student Society (DS3)", logo: "/club-logos/ds3.png" },
    ],
    coOrganizers: [
      { name: "Google Developer Group on Campus (GDG)", logo: "/club-logos/gdg.webp" },
      { name: "AWS Cloud Club", logo: "/club-logos/aws.png" },
      { name: "Triton Quantitative Trading (TQT)", logo: "/club-logos/tqt.png" },
      { name: "Biomedical Engineering Society (BMES)", logo: "/club-logos/bmes.png" },
      { name: "Startup Incubator Club", logo: "/club-logos/startup.PNG" },
    ],
    partners: [
      { name: "Triton Software Engineering (TSE)", logo: "/club-logos/tse.png" },
      { name: "Startup Incubator Club", logo: "/club-logos/aisc.png" },
    ],
  };

  return (
    <section
      id="about"
      ref={ref}
      className="relative py-24 md:py-32 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, hsl(200 85% 45%) 0%, hsl(205 85% 38%) 100%)",
      }}
    >
      <Bubbles count={10} />

      {/* Light Rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute top-0 w-32 h-full opacity-10"
            style={{
              left: `${i * 25}%`,
              background: "linear-gradient(180deg, white 0%, transparent 60%)",
              transform: `skewX(${-15 + i * 5}deg)`,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            About DataHacks
          </h2>
          <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
          DataHacks 2026 is a hackathon bringing together 400 students from across the country for 36 hours of innovation, collaboration, and creativity. With hands-on workshops, industry & faculty mentors, exciting prizes, free food, and direct access to top companies and researchers, DataHacks is more than a competition: it's a launchpad for ideas, careers, and community. Join us for 36 hours of
          innovation, learning, and fun!
          </p>
        </motion.div>

        {/* Photo Grid */}
        <motion.div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-20">
          {["photo1.png", "photo2.png", "photo3.png"].map((photo, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden shadow-lg bg-black/10"
            >
              <img
                src={`/images/${photo}`}
                alt="DataHacks event"
                className="w-full h-48 md:h-52 object-cover"
              />
            </div>
          ))}
        </motion.div>

        {/* Organizers Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >

          {/* Primary Organizer */}
          <div className="mb-16 text-center">
            <h3 className="text-white/80 text-sm uppercase tracking-widest mb-6">
              Primary Organizer
            </h3>
            <div className="flex justify-center">
              {organizers.primary.map((club) => (
                <motion.div
                  key={club.name}
                  whileHover={{ scale: 1.05 }}
                  className="w-64 h-40 bg-white/25 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30 shadow-xl"
                >
                  <img
                    src={club.logo}
                    alt={club.name}
                    className="max-h-28 max-w-full object-contain"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Co-Organizers */}
          <div className="mb-14 text-center">
            <h3 className="text-white/70 text-sm uppercase tracking-widest mb-6">
              Co-Organizers
            </h3>
            <div className="flex flex-wrap justify-center gap-8">
              {organizers.coOrganizers.map((club) => (
                <motion.div
                  key={club.name}
                  whileHover={{ scale: 1.05 }}
                  className="w-48 h-32 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20"
                >
                  <img
                    src={club.logo}
                    alt={club.name}
                    className="max-h-20 max-w-full object-contain"
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Partners */}
          <div className="text-center">
            <h3 className="text-white/60 text-xs uppercase tracking-widest mb-6">
              Partners
            </h3>
            <div className="flex flex-wrap justify-center gap-6">
              {organizers.partners.map((club) => (
                <motion.div
                  key={club.name}
                  whileHover={{ scale: 1.05 }}
                  className="w-36 h-24 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10"
                >
                  <img
                    src={club.logo}
                    alt={club.name}
                    className="max-h-14 max-w-full object-contain opacity-90"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;