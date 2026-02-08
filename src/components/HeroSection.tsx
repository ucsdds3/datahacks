 import { useState, useEffect } from "react";
 import { motion } from "framer-motion";
 import { MapPin, Calendar } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import WaveAnimation from "./animations/WaveAnimation";
 import SunRays from "./animations/SunRays";
 
 interface TimeLeft {
   days: number;
   hours: number;
   minutes: number;
   seconds: number;
 }
 
 const HeroSection = () => {
   // Set your hackathon date here
   const hackathonDate = new Date("2026-04-18T09:00:00");
   const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
 
   useEffect(() => {
     const calculateTimeLeft = () => {
       const difference = hackathonDate.getTime() - new Date().getTime();
       
       if (difference > 0) {
         setTimeLeft({
           days: Math.floor(difference / (1000 * 60 * 60 * 24)),
           hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
           minutes: Math.floor((difference / 1000 / 60) % 60),
           seconds: Math.floor((difference / 1000) % 60),
         });
       }
     };
 
     calculateTimeLeft();
     const timer = setInterval(calculateTimeLeft, 1000);
     return () => clearInterval(timer);
   }, []);
 
   const timeBlocks = [
     { label: "Days", value: timeLeft.days },
     { label: "Hours", value: timeLeft.hours },
     { label: "Minutes", value: timeLeft.minutes },
     { label: "Seconds", value: timeLeft.seconds },
   ];
 
   return (
     <section
       id="hero"
       className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(200 100% 85%) 0%, hsl(190 90% 75%) 60%, hsl(195 80% 65%) 100%)",
       }}
     >
       {/* Sun */}
       <div className="absolute top-10 right-10 md:top-20 md:right-32">
         <div className="relative">
           <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-sun animate-pulse" 
                style={{ boxShadow: "0 0 60px hsl(40 100% 60%), 0 0 120px hsl(40 100% 60% / 0.5)" }} />
           <SunRays />
         </div>
       </div>
 
       {/* Main Content */}
       <motion.div
         initial={{ opacity: 0, y: 30 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.8 }}
         className="container mx-auto px-4 text-center z-10 mt-16"
       >
 
         <motion.h1
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-foreground mb-4"
         >
           DataHacks
           <span className="block text-primary">2026</span>
         </motion.h1>
 
         <motion.p
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.5 }}
           className="text-xl md:text-2xl text-muted-foreground mb-2 font-medium"
         >
         </motion.p>
 
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.6 }}
           className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground mb-8"
         >
           <div className="flex items-center gap-2">
             <MapPin className="w-5 h-5 text-coral" />
             <span className="font-medium">UC San Diego</span>
           </div>
           <div className="flex items-center gap-2">
             <Calendar className="w-5 h-5 text-secondary" />
             <span className="font-medium">April 18-19, 2026</span>
           </div>
         </motion.div>
 
         {/* Countdown Timer */}
         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.7 }}
           className="flex flex-wrap justify-center gap-4 mb-10"
         >
           {timeBlocks.map((block) => (
             <div
               key={block.label}
               className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-xl min-w-[80px] md:min-w-[100px]"
             >
               <div className="font-display text-3xl md:text-5xl font-bold text-primary">
                 {block.value.toString().padStart(2, "0")}
               </div>
               <div className="text-sm text-muted-foreground font-medium">{block.label}</div>
             </div>
           ))}
         </motion.div>
 
         {/* CTA Button */}
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.9 }}
         >
           <Button
             asChild
             size="lg"
             className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg px-8 py-6 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-105"
           >
             <a href="#" target="_blank" rel="noopener noreferrer">
               Registration Opens 02/16/2026
             </a>
           </Button>
         </motion.div>
       </motion.div>
 
       {/* Wave Animation at bottom */}
       <WaveAnimation />
     </section>
   );
 };
 
 export default HeroSection;