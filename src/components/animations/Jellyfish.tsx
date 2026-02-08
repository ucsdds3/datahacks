 import { motion } from "framer-motion";
 
 interface JellyfishProps {
   size?: number;
   left?: string;
   delay?: number;
 }
 
 const Jellyfish = ({ size = 60, left = "50%", delay = 0 }: JellyfishProps) => {
   return (
     <motion.div
       className="absolute pointer-events-none"
       style={{ left }}
       initial={{ y: "100vh", opacity: 0 }}
       animate={{ 
         y: [0, -100, -50, -150, -100],
         opacity: [0, 0.8, 0.8, 0.8, 0],
         x: [0, 20, -10, 30, 0]
       }}
       transition={{
         duration: 15,
         delay,
         repeat: Infinity,
         ease: "easeInOut",
       }}
     >
       <div className="relative" style={{ width: size, height: size * 1.5 }}>
         {/* Bell/Hood */}
         <motion.div
           className="absolute rounded-t-full"
           style={{
             width: size,
             height: size * 0.7,
             background: "linear-gradient(180deg, hsl(280 60% 70% / 0.6) 0%, hsl(200 80% 70% / 0.4) 100%)",
             boxShadow: "0 0 30px hsl(180 100% 70% / 0.5), inset 0 -10px 20px hsl(180 100% 70% / 0.3)",
           }}
           animate={{ scaleY: [1, 0.8, 1] }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
         />
         
         {/* Tentacles */}
         {[...Array(5)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute rounded-full"
             style={{
               width: 3,
               height: size * 0.8,
               left: `${15 + i * 18}%`,
               top: size * 0.65,
               background: "linear-gradient(180deg, hsl(280 60% 70% / 0.5) 0%, hsl(180 100% 70% / 0.2) 100%)",
             }}
             animate={{ 
               x: [0, (i - 2) * 5, 0],
               scaleY: [1, 1.1, 1]
             }}
             transition={{ 
               duration: 2, 
               repeat: Infinity, 
               ease: "easeInOut",
               delay: i * 0.1
             }}
           />
         ))}
       </div>
     </motion.div>
   );
 };
 
 interface JellyfishGroupProps {
   count?: number;
 }
 
 const JellyfishGroup = ({ count = 3 }: JellyfishGroupProps) => {
   return (
     <div className="absolute inset-0 overflow-hidden pointer-events-none">
       {[...Array(count)].map((_, i) => (
         <Jellyfish
           key={i}
           size={40 + Math.random() * 30}
           left={`${15 + i * 30}%`}
           delay={i * 5}
         />
       ))}
     </div>
   );
 };
 
 export { Jellyfish, JellyfishGroup };
 export default Jellyfish;