 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 // import { Leaf, Zap, Globe } from "lucide-react";
 import Bubbles from "../animations/Bubbles";
 
 const AboutSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
  //  const features = [
  //    {
  //      icon: Zap,
  //      title: "Energy Innovation",
  //      description: "Develop solutions for renewable energy, smart grids, and sustainable power systems.",
  //    },
  //    {
  //      icon: Globe,
  //      title: "Climate Action",
  //      description: "Create tools to monitor, predict, and combat climate change using data science.",
  //    },
  //    {
  //      icon: Leaf,
  //      title: "Environmental Science",
  //      description: "Build applications for biodiversity, conservation, and ecosystem monitoring.",
  //    },
  //  ];

  const clubs = [
    { name: "Data Science Student Society (DS3)", logo: "/club-logos/ds3.png" },
    { name: "Google Developer Group on Campus (GDG)", logo: "/club-logos/gdg.webp" },
    { name: "AWS Cloud Club", logo: "/club-logos/aws.png" },
    { name: "Triton Quantiative Trading (TQT)", logo: "/club-logos/tqt.png" },
    { name: "Biomedical Engineering Society (BMES)", logo: "/club-logos/bmes.png" },
    { name: "Startup Incubator Club", logo: "🏛️" },
  ];
  
 
   return (
     <section
       id="about"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(200 85% 45%) 0%, hsl(205 85% 38%) 100%)",
       }}
     >
       <Bubbles count={10} />
       
       {/* Light rays */}
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
             DataHacks 2026 is a premier hackathon at UC San Diego, bringing together 
             400+ undergraduate and graduate students to tackle real-world challenges in data science, engineering, artificial intelligence, design, and entrepreneurship. Join us for 36 hours of innovation, learning, and fun!
           </p>
         </motion.div>

         {/* Clubsr */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.5, delay: 0.1 }}
           className="mb-12"
         >
           <h2 className="text-center text-bioluminescent font-large mb-6">Organizing Student Organizations</h2>
           <div className="flex flex-wrap justify-center gap-8">
             {clubs.map((sponsor, i) => (
               <motion.div
                 key={sponsor.name}
                 whileHover={{ scale: 1.05 }}
                 className="w-48 h-32 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-bioluminescent/30 hover:border-bioluminescent/60 transition-colors"
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
 
         {/* <div className="grid md:grid-cols-3 gap-8">
           {features.map((feature, index) => (
             <motion.div
               key={feature.title}
               initial={{ opacity: 0, y: 40 }}
               animate={isInView ? { opacity: 1, y: 0 } : {}}
               transition={{ duration: 0.6, delay: index * 0.2 }}
               className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-colors"
             >
               <div className="w-14 h-14 bg-accent rounded-xl flex items-center justify-center mb-6">
                 <feature.icon className="w-7 h-7 text-accent-foreground" />
               </div>
               <h3 className="font-display text-2xl font-bold text-white mb-3">
                 {feature.title}
               </h3>
               <p className="text-white/80 leading-relaxed">
                 {feature.description}
               </p>
             </motion.div>
           ))}
         </div> */}
       </div>
     </section>
   );
 };
 
 export default AboutSection;