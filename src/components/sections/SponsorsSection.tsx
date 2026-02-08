 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 
 const SponsorsSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   // Placeholder sponsors - replace with actual sponsor logos
   const tiers = {
     platinum: [
       { name: "Platinum Sponsor 1", logo: "🏢" },
       { name: "Platinum Sponsor 2", logo: "🏛️" },
     ],
     gold: [
       { name: "Gold Sponsor 1", logo: "🏗️" },
       { name: "Gold Sponsor 2", logo: "🏭" },
       { name: "Gold Sponsor 3", logo: "🏦" },
     ],
     silver: [
       { name: "Silver Sponsor 1", logo: "🏬" },
       { name: "Silver Sponsor 2", logo: "🏫" },
       { name: "Silver Sponsor 3", logo: "🏨" },
       { name: "Silver Sponsor 4", logo: "🏤" },
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
             Our Sponsors
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
           <h3 className="text-center text-bioluminescent font-medium mb-6">Platinum Partners</h3>
           <div className="flex flex-wrap justify-center gap-8">
             {tiers.platinum.map((sponsor, i) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="w-48 h-32 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-bioluminescent/30 hover:border-bioluminescent/60 transition-colors"
               >
                 <span className="text-5xl">{sponsor.logo}</span>
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
           <h3 className="text-center text-accent font-medium mb-6">Gold Partners</h3>
           <div className="flex flex-wrap justify-center gap-6">
             {tiers.gold.map((sponsor) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="w-40 h-28 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-accent/30 hover:border-accent/60 transition-colors"
               >
                 <span className="text-4xl">{sponsor.logo}</span>
               </motion.div>
             ))}
           </div>
         </motion.div>
 
         {/* Silver Tier */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.5, delay: 0.3 }}
         >
           <h3 className="text-center text-white/60 font-medium mb-6">Silver Partners</h3>
           <div className="flex flex-wrap justify-center gap-4">
             {tiers.silver.map((sponsor) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="w-32 h-24 bg-white/5 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/20 hover:border-white/40 transition-colors"
               >
                 <span className="text-3xl">{sponsor.logo}</span>
               </motion.div>
             ))}
           </div>
         </motion.div>
 
         <motion.p
           initial={{ opacity: 0 }}
           animate={isInView ? { opacity: 1 } : {}}
           transition={{ duration: 0.5, delay: 0.5 }}
           className="text-center text-white/60 mt-12"
         >
           Interested in sponsoring?{" "}
           <a href="#contact" className="text-accent hover:underline">
             Contact us
           </a>
         </motion.p>
       </div>
     </section>
   );
 };
 
 export default SponsorsSection;