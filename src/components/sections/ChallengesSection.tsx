 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 import { Building2, Lightbulb, Target } from "lucide-react";
 import Bubbles from "../animations/Bubbles";
 
 const ChallengesSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const challenges = [
     {
       sponsor: "Sponsor Challenge 1",
       title: "Smart Grid Optimization",
       description: "Design an AI-powered solution to optimize energy distribution across smart grids, reducing waste and improving efficiency.",
       prize: "$2,000",
       icon: Lightbulb,
     },
     {
       sponsor: "Sponsor Challenge 2",
       title: "Carbon Footprint Tracker",
       description: "Build a user-friendly application that helps individuals and businesses track and reduce their carbon footprint.",
       prize: "$1,500",
       icon: Target,
     },
     {
       sponsor: "Sponsor Challenge 3",
       title: "Ocean Plastic Detection",
       description: "Create a computer vision system to detect and map plastic pollution in ocean imagery from satellites or drones.",
       prize: "$1,500",
       icon: Building2,
     },
   ];
 
   return (
     <section
       id="challenges"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(210 88% 30%) 0%, hsl(215 90% 22%) 100%)",
       }}
     >
       <Bubbles count={8} />
 
       {/* Bioluminescent particles */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         {[...Array(20)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute w-1 h-1 rounded-full bg-bioluminescent"
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
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-16"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Sponsor Challenges
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Take on special challenges from our sponsors for additional prizes and recognition.
           </p>
         </motion.div>
 
         <div className="grid md:grid-cols-3 gap-8">
           {challenges.map((challenge, index) => (
             <motion.div
               key={challenge.title}
               initial={{ opacity: 0, y: 40 }}
               animate={isInView ? { opacity: 1, y: 0 } : {}}
               transition={{ duration: 0.5, delay: index * 0.15 }}
               whileHover={{ y: -10 }}
               className="relative group"
             >
               <div className="absolute inset-0 bg-bioluminescent/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
               <div className="relative bg-deep-water/50 backdrop-blur-md rounded-2xl p-8 border border-bioluminescent/20 h-full flex flex-col">
                 <div className="text-sm font-medium text-bioluminescent mb-2">
                   {challenge.sponsor}
                 </div>
                 <div className="w-12 h-12 bg-bioluminescent/20 rounded-xl flex items-center justify-center mb-4">
                   <challenge.icon className="w-6 h-6 text-bioluminescent" />
                 </div>
                 <h3 className="font-display text-xl font-bold text-white mb-3">
                   {challenge.title}
                 </h3>
                 <p className="text-white/70 leading-relaxed flex-grow">
                   {challenge.description}
                 </p>
                 <div className="mt-6 pt-4 border-t border-white/10">
                   <span className="font-display text-2xl font-bold text-accent">
                     {challenge.prize}
                   </span>
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