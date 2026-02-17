 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 import { Mail, MapPin, ExternalLink } from "lucide-react";
 import { Button } from "@/components/ui/button";
 
 const ContactSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const socialLinks = [
     { name: "Instagram", url: "https://www.instagram.com/ds3atucsd/?hl=en", icon: "📷" },
     { name: "Website", url: "https://www.ds3atucsd.com/", icon: "🌍" },
     { name: "Discord", url: "https://discord.gg/9yYWrTej", icon: "💬" },
     { name: "LinkedIn", url: "https://linkedin.com/company/data-science-student-society-at-ucsd/", icon: "💼" },
   ];
 
   return (
     <section
       id="contact"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(224 95% 10%) 0%, hsl(225 95% 8%) 100%)",
       }}
     >
       {/* Ocean floor decoration */}
       <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
         <svg
           viewBox="0 0 1440 120"
           className="w-full h-full"
           preserveAspectRatio="none"
         >
           <path
             d="M0,60 Q100,30 200,50 T400,40 T600,55 T800,35 T1000,50 T1200,40 T1440,55 L1440,120 L0,120 Z"
             fill="hsl(140 30% 15%)"
             opacity="0.5"
           />
           <path
             d="M0,80 Q150,60 300,75 T600,65 T900,80 T1200,70 T1440,85 L1440,120 L0,120 Z"
             fill="hsl(140 35% 12%)"
             opacity="0.7"
           />
         </svg>
         
         {/* Coral/seaweed silhouettes */}
         <div className="absolute bottom-0 left-10 w-16 h-24 bg-seaweed/30 rounded-t-full" />
         <div className="absolute bottom-0 left-20 w-8 h-16 bg-coral/20 rounded-t-full" />
         <div className="absolute bottom-0 right-20 w-12 h-20 bg-seaweed/25 rounded-t-full" />
         <div className="absolute bottom-0 right-10 w-6 h-12 bg-coral/15 rounded-t-full" />
       </div>
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-12"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Get In Touch
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Have questions? Reach out to our team!
           </p>
         </motion.div>
 
         <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
           {/* Contact Info */}
           <motion.div
             initial={{ opacity: 0, x: -30 }}
             animate={isInView ? { opacity: 1, x: 0 } : {}}
             transition={{ duration: 0.6, delay: 0.2 }}
             className="space-y-6"
           >
             <div className="flex items-start gap-4">
               <div className="w-12 h-12 bg-bioluminescent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                 <Mail className="w-6 h-6 text-bioluminescent" />
               </div>
               <div>
                 <h4 className="font-display text-lg font-bold text-white mb-1">Email Us</h4>
                 <a href="mailto:datahacks@ucsd.edu" className="text-bioluminescent hover:underline">
                   ds3@ucsd.edu
                 </a>
               </div>
             </div>
 
             <div className="flex items-start gap-4">
               <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                 <MapPin className="w-6 h-6 text-secondary" />
               </div>
               <div>
                 <h4 className="font-display text-lg font-bold text-white mb-1">Location</h4>
                 <p className="text-white/70">
                   UC San Diego<br />
                   La Jolla, CA 92093
                 </p>
               </div>
             </div>
 
             {/* Social Links */}
             <div className="pt-4">
               <h4 className="font-display text-lg font-bold text-white mb-4">Follow Us</h4>
               <div className="flex gap-4">
                 {socialLinks.map((link) => (
                   <motion.a
                     key={link.name}
                     href={link.url}
                     target="_blank"
                     rel="noopener noreferrer"
                     whileHover={{ scale: 1.1 }}
                     className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl hover:bg-white/20 transition-colors"
                   >
                     {link.icon}
                   </motion.a>
                 ))}
               </div>
             </div>
           </motion.div>
 
           {/* CTA Card */}
           <motion.div
             initial={{ opacity: 0, x: 30 }}
             animate={isInView ? { opacity: 1, x: 0 } : {}}
             transition={{ duration: 0.6, delay: 0.3 }}
             className="bg-gradient-to-br from-bioluminescent/20 to-secondary/20 backdrop-blur-md rounded-2xl p-8 border border-bioluminescent/30"
           >
             <h3 className="font-display text-2xl font-bold text-white mb-4">
               Ready to Dive In?
             </h3>
             <p className="text-white/70 mb-6">
               Join 400+ students in tackling real-world challenges in data science, engineering, artificial intelligence, design, and entrepreneurship. 
               Registration opens 02/16/2026!
             </p>
             <Button
               asChild
               size="lg"
               className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
             >
               <a href="https://docs.google.com/forms/d/e/1FAIpQLScWZ1-QNCF55GJrnIhXD2ZLJqriXSOJ8V8gDQFkzbQqKNRmlQ/viewform" target="_blank" rel="noopener noreferrer">
               Registration OPEN NOW! <ExternalLink className="w-4 h-4 ml-2" />
               </a>
             </Button>
           </motion.div>
         </div>
 
         {/* Footer */}
         <motion.footer
           initial={{ opacity: 0 }}
           animate={isInView ? { opacity: 1 } : {}}
           transition={{ duration: 0.6, delay: 0.5 }}
           className="mt-20 pt-8 border-t border-white/10 text-center"
         >
           <div className="flex flex-wrap items-center justify-center gap-6 text-white/60 text-sm mb-4">
             <a href="https://mlh.io/code-of-conduct" target="_blank" rel="noopener noreferrer" className="hover:text-bioluminescent transition-colors">
               MLH Code of Conduct
             </a>
             <span>•</span>
             <a href="https://datahacks.ds3ucsd.com/" target="_blank" rel="noopener noreferrer" className="hover:text-bioluminescent transition-colors">
               DataHacks Official
             </a>
             <span>•</span>
             <a href="https://www.ds3atucsd.com/" target="_blank" rel="noopener noreferrer" className="hover:text-bioluminescent transition-colors">
               Data Science Student Society (DS3)
             </a>
           </div>
           <p className="text-white/40 text-sm">
             © 2026 DataHacks at UC San Diego. Made with data.
           </p>
         </motion.footer>
       </div>
     </section>
   );
 };
 
 export default ContactSection;