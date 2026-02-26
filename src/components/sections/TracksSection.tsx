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
      icon: NotebookPen,
      title: "Data Analytics",
      description:
        "Use statistics and data-driven experimentation to analyze trends and power evidence-based business decisions.",
      color: "from-deep-water to-mid-water",
    },
    {
      icon: Bot,
      title: "Machine Learning & AI",
      description:
        "Develop intelligent systems using data-driven techniques such as modeling, prediction, and classification.",
      color: "from-deep-water to-mid-water",
    },
    {
      icon: Cpu,
      title: "Hardware & IoT",
      description:
        "Build sensor-driven systems using microcontrollers, embedded devices, and edge computing.",
      color: "from-mid-water to-seaweed",
    },
    {
      icon: Cloud,
      title: "Cloud Development",
      description:
        "Design and deploy scalable systems for processing, storage, and real-time apps using cloud infrastructure.",
      color: "from-mid-water to-deep-water",
    },
    {
      icon: Dna,
      title: "Biotechnology",
      description:
        "Prototype systems or devices that interface with biological data, signals, or processes through applied engineering.",
      color: "from-seaweed to-secondary",
    },
    {
      icon: TrendingUp,
      title: "Economics",
      description:
        "Create quantitative models for forecasting, optimization, and analysis of complex systems and decision-making.",
      color: "from-accent to-sun",
    },
    {
      icon: Palette,
      title: "UI/UX Design & Web Development",
      description:
        "Design intuitive, accessible, and engaging user experiences that communicate data and system behavior.",
      color: "from-secondary to-primary",
    },
    {
      icon: Rocket,
      title: "Product & Entrepreneurship",
      description:
        "Transform technical ideas into compelling solutions by focusing on impact, feasibility, and effective storytelling.",
      color: "from-secondary to-accent",
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
             Domain Tracks
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
           Choose one primary domain track and optionally one secondary track that best represent your project.
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