 import { motion } from "framer-motion";
 
 interface FishProps {
   direction?: "left" | "right";
   delay?: number;
   top?: string;
   size?: number;
   color?: string;
 }
 
 const Fish = ({ 
   direction = "right", 
   delay = 0, 
   top = "50%", 
   size = 30,
   color = "hsl(200 80% 60%)"
 }: FishProps) => {
   const isRight = direction === "right";
   
   return (
     <motion.div
       className="absolute pointer-events-none"
       style={{ top }}
       initial={{ 
         x: isRight ? -100 : "calc(100vw + 100px)",
         scaleX: isRight ? 1 : -1
       }}
       animate={{ 
         x: isRight ? "calc(100vw + 100px)" : -100
       }}
       transition={{
         duration: 20 + Math.random() * 10,
         delay,
         repeat: Infinity,
         ease: "linear",
       }}
     >
       <svg
         width={size}
         height={size * 0.6}
         viewBox="0 0 50 30"
         fill={color}
       >
         <ellipse cx="25" cy="15" rx="20" ry="10" />
         <polygon points="5,15 0,5 0,25" />
         <circle cx="35" cy="12" r="3" fill="white" />
         <circle cx="36" cy="12" r="1.5" fill="black" />
       </svg>
     </motion.div>
   );
 };
 
 interface FishSchoolProps {
   count?: number;
 }
 
 const FishSchool = ({ count = 5 }: FishSchoolProps) => {
   const colors = [
     "hsl(200 80% 60%)",
     "hsl(180 70% 50%)",
     "hsl(350 80% 60%)",
     "hsl(45 90% 60%)",
     "hsl(280 70% 60%)",
   ];
 
   return (
     <div className="absolute inset-0 overflow-hidden pointer-events-none">
       {[...Array(count)].map((_, i) => (
         <Fish
           key={i}
           direction={i % 2 === 0 ? "right" : "left"}
           delay={i * 3}
           top={`${20 + Math.random() * 60}%`}
           size={25 + Math.random() * 20}
           color={colors[i % colors.length]}
         />
       ))}
     </div>
   );
 };
 
 export { Fish, FishSchool };
 export default Fish;