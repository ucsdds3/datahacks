 import { motion } from "framer-motion";
 
 interface BubblesProps {
   count?: number;
   className?: string;
 }
 
 const Bubbles = ({ count = 15, className = "" }: BubblesProps) => {
   return (
     <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
       {[...Array(count)].map((_, i) => {
         const size = Math.random() * 20 + 5;
         const left = Math.random() * 100;
         const delay = Math.random() * 5;
         const duration = Math.random() * 10 + 8;
 
         return (
           <motion.div
             key={i}
             className="absolute rounded-full bg-white/30 backdrop-blur-sm"
             style={{
               width: size,
               height: size,
               left: `${left}%`,
               bottom: "-20px",
             }}
             animate={{
               y: [0, -window.innerHeight - 100],
               x: [0, Math.sin(i) * 50],
               opacity: [0, 0.6, 0.6, 0],
             }}
             transition={{
               duration: duration,
               delay: delay,
               repeat: Infinity,
               ease: "linear",
             }}
           />
         );
       })}
     </div>
   );
 };
 
 export default Bubbles;