 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 import { Trophy, Award, Medal, Star } from "lucide-react";
 
 const PrizesSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const prizes = [
     {
       place: "1st Place",
       prize: "$600",
       icon: Trophy,
       color: "from-sun via-accent to-sun",
       extras: ["Sponsor Swag Pack", "Featured on Website", "Platform Credits", "Talent Pool Boost"],
     },
     {
       place: "2nd Place",
       prize: "$300",
       icon: Award,
       color: "from-gray-300 via-white to-gray-300",
       extras: ["Sponsor Swag Pack", "LinkedIn Feature"],
     },
     {
       place: "3rd Place",
       prize: "$100",
       icon: Medal,
       color: "from-amber-600 via-amber-500 to-amber-600",
       extras: ["Sponsor Swag Pack"],
     },
   ];
  
 
   const trackPrizes = [
     { track: "Renewable Energy", prize: "$1,000" },
     { track: "Climate Modeling", prize: "$1,000" },
     { track: "Water & Ocean", prize: "$1,000" },
     { track: "Biodiversity", prize: "$1,000" },
   ];
 
   return (
     <section
       id="prizes"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
        background: "linear-gradient(180deg, hsl(210 88% 30%) 0%, hsl(215 90% 22%) 100%)",
       }}
     >
       {/* Treasure glow effect */}
       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/20 rounded-full blur-[100px]" />
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-16"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Track Prizes
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
           EACH domain track awards top teams with cash prizes, swag, and sponsor-provided rewards. Prize amounts and rewards may vary by track.
           </p>
         </motion.div>
 
         {/* Main Prizes */}
         <div className="grid md:grid-cols-3 gap-8 mb-16">
           {prizes.map((prize, index) => (
             <motion.div
               key={prize.place}
               initial={{ opacity: 0, y: 40, scale: 0.9 }}
               animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
               transition={{ duration: 0.5, delay: index * 0.15 }}
               className={`relative ${index === 0 ? "md:-mt-8" : ""}`}
             >
               <div className={`absolute inset-0 bg-gradient-to-br ${prize.color} rounded-2xl opacity-10`} />
               <div className="relative bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center h-full">
                 <div className={`w-20 h-20 mx-auto bg-gradient-to-br ${prize.color} rounded-full flex items-center justify-center mb-6 shadow-lg`}>
                   <prize.icon className="w-10 h-10 text-deep-water" />
                 </div>
                 <div className="text-lg font-medium text-white/60 mb-2">
                   {prize.place}
                 </div>
                 <div className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                   {prize.prize}
                 </div>
                 <ul className="space-y-2">
                   {prize.extras.map((extra) => (
                     <li key={extra} className="flex items-center justify-center gap-2 text-white/70">
                       <Star className="w-4 h-4 text-accent" />
                       {extra}
                     </li>
                   ))}
                 </ul>
               </div>
             </motion.div>
           ))}
         </div>
 
         {/* <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6, delay: 0.5 }}
           className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10"
         >
           <h3 className="font-display text-2xl font-bold text-white text-center mb-8">
             Track-Specific Prizes
           </h3>
           <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
             {trackPrizes.map((item) => (
               <div key={item.track} className="text-center p-4 bg-white/5 rounded-xl">
                 <div className="text-white/70 mb-2">{item.track}</div>
                 <div className="font-display text-2xl font-bold text-accent">{item.prize}</div>
               </div>
             ))}
           </div>
         </motion.div> */}

       </div>
     </section>
   );
 };
 
 export default PrizesSection;