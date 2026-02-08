 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 
 const SponsorsSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   // Placeholder sponsors - replace with actual sponsor logos
   const tiers = {
     sponsors: [
      //  { name: "Qualcomm", logo: "/sponsors/qualcomm.png" },
      //  { name: "Amazon", logo: "/sponsors/amazon.png" },
      //  { name: "Google", logo: "/sponsors/google.png" },
      //  { name: "Databricks", logo: "/sponsors/databricks.png" },
      //  { name: "Data Science Alliance", logo: "/sponsors/dsa.png" },
      //  { name: "Marimo", logo: "/sponsors/marimo.png" },
      //  { name: "Sphinx", logo: "/sponsors/sphinx.png" },
       { name: "HDSI", logo: "/sponsors/hdsi.png" },
       { name: "Scripps", logo: "/sponsors/scripps.png" },
       { name: "The Basement", logo: "/sponsors/basement.png" },
     ],
     partners: [
      { name: "MongoDB", logo: "/partners/mongo.png" },
      { name: "GitHub", logo: "/partners/github.png" },
      { name: "JetBrains", logo: "/partners/jetbrains.png" },
     ],
   };
 
   return (
     <section
       id="sponsors"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(218 92% 18%) 0%, hsl(220 95% 15%) 100%)",
       }}
     >
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-16"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Sponsors & Partners
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Thank you to our amazing sponsors for making DataHacks 2026 possible!
           </p>
         </motion.div>
 
         {/* Platinum Tier */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.5, delay: 0.1 }}
           className="mb-12"
         >
           <h3 className="text-3xl text-center text-accent font-medium mb-6">Sponsors</h3>
           <div className="flex flex-wrap justify-center gap-8">
             {tiers.sponsors.map((sponsor, i) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="
                    w-64 h-40
                    p-6
                    bg-white/70
                    backdrop-blur-md
                    rounded-2xl
                    flex items-center justify-center
                    border border-bioluminescent/30
                    hover:border-bioluminescent/60
                    hover:scale-105
                    transition-all duration-300
                  "
              >
                 {typeof sponsor.logo === "string" && sponsor.logo.startsWith("/") ? (
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-h-24 object-contain"
                    />
                  ) : (
                    <span className="text-5xl">{sponsor.logo}</span>
                  )}
               </motion.div>
             ))}
           </div>
         </motion.div>
 
         {/* Gold Tier */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.5, delay: 0.2 }}
           className="mb-12"
         >
           <h3 className="text-3xl text-center text-bioluminescent font-medium mb-6">Partners</h3>
           <div className="flex flex-wrap justify-center gap-6">
             {tiers.partners.map((sponsor) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="
                    w-44 h-30
                    p-6
                    bg-white/70
                    backdrop-blur-md
                    rounded-2xl
                    flex items-center justify-center
                    border border-bioluminescent/30
                    hover:border-bioluminescent/60
                    hover:scale-105
                    transition-all duration-300
                  "
              >
                 {typeof sponsor.logo === "string" && sponsor.logo.startsWith("/") ? (
                    <img
                      src={sponsor.logo}
                      alt={sponsor.name}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-5xl">{sponsor.logo}</span>
                  )}
               </motion.div>
             ))}
           </div>
         </motion.div>
 
         
         <motion.p
           initial={{ opacity: 0 }}
           animate={isInView ? { opacity: 1 } : {}}
           transition={{ duration: 0.5, delay: 0.5 }}
           className="text-2xl text-center text-white/60 mt-12"
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