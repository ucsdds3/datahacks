 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 import {
  Bot,
  Search,
  Cloud,
  Rocket,
  NotebookPen,
  Dna,
  TrendingUp,
  Cpu,
  Palette,
} from "lucide-react";
 import { FishSchool } from "../animations/Fish";
 
 const TracksSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
    
    const tracks = [
      {
        icon: Bot,
        title: "Machine Learning",
        description:
          "Build intelligent systems using data-driven methods such as analysis, prediction, classification, and optimization.",
        color: "from-deep-water to-mid-water",
      },
      {
        icon: Cpu,
        title: "Hardware",
        description:
          "Engineer sensor-driven systems using microcontrollers and edge AI.",
        color: "from-mid-water to-seaweed",
      },
      {
        icon: Search,
        title: "GCP & Google AI",
        description:
          "Create scalable applications using Google Cloud Platform and Google's AI ecosystem.",
        color: "from-accent to-primary",
      },
      {
        icon: Cloud,
        title: "AWS",
        description:
          "Design and deploy scalable data-intensive systems using AWS services.",
        color: "from-mid-water to-deep-water",
      },
      {
        icon: Rocket,
        title: "Entrepreneurship",
        description:
          "Turn data-driven ideas into viable solutions with real-world impact, with an emphesis on presentation.",
        color: "from-secondary to-accent",
      },
      {
        icon: NotebookPen,
        title: "Marimo x Sphinx",
        description:
          "Build interactive data apps and documentation-first workflows.",
        color: "from-primary to-secondary",
      },
      {
        icon: Dna,
        title: "Biotechnology",
        description:
          "Applying your skills towards specific biological and health-related problems.",
        color: "from-seaweed to-secondary",
      },
      {
        icon: TrendingUp,
        title: "Economics",
        description:
          "Build economic or financial models for forecasting, optimization, and data-driven decision making.",
        color: "from-accent to-sun",
      },
      {
        icon: Palette,
        title: "Design",
        description:
          "Craft intuitive and visually compelling user experiences for data-driven products. ",
        color: "from-secondary to-primary",
      },
    ];    
  
 
   return (
     <section
       id="tracks"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(205 85% 38%) 0%, hsl(210 88% 30%) 100%)",
       }}
     >
       <FishSchool count={4} />
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-16"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Hackathon Tracks
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Choose your area of focus and dive deep into solving real environmental challenges.
           </p>
         </motion.div>
 
         <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
           {tracks.map((track, index) => (
             <motion.div
               key={track.title}
               initial={{ opacity: 0, y: 40, scale: 0.95 }}
               animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
               transition={{ duration: 0.5, delay: index * 0.15 }}
               whileHover={{ scale: 1.02, y: -5 }}
               className="relative group"
             >
               <div className={`absolute inset-0 bg-gradient-to-br ${track.color} rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity`} />
               <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                 <div className={`w-16 h-16 bg-gradient-to-br ${track.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                   <track.icon className="w-8 h-8 text-white" />
                 </div>
                 <h3 className="font-display text-2xl font-bold text-white mb-3">
                   {track.title}
                 </h3>
                 <p className="text-white/75 leading-relaxed">
                   {track.description}
                 </p>
               </div>
             </motion.div>
           ))}
         </div>
       </div>
     </section>
   );
 };
 
 export default TracksSection;