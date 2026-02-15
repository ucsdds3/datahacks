 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef, useState } from "react";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { JellyfishGroup } from "../animations/Jellyfish";
 
 const TeamSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const judges = [
    {
      name: "To-be Revealed",
      title: "To-be Revealed",
      affiliation: "To-be Revealed",
      image: "🧑‍💻",
    },
   ];
 
   const mentors = [
     {
       name: "To-be Revealed",
       title: "To-be Revealed",
       affiliation: "To-be Revealed",
       image: "🧑‍💻",
     },
   ];
 
   const PersonCard = ({ person }: { person: typeof judges[0] }) => (
     <motion.div
       whileHover={{ y: -5 }}
       title={`${person.name} - ${person.title}`}
       className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-bioluminescent/20 text-center group"
     >
       <div className="w-20 h-20 mx-auto bg-gradient-to-br from-bioluminescent/30 to-secondary/30 rounded-full flex items-center justify-center mb-4 text-4xl group-hover:shadow-lg group-hover:shadow-bioluminescent/30 transition-shadow">
         {person.image}
       </div>
       <h4 className="font-display text-lg font-bold text-white mb-1">
         {person.name}
       </h4>
       <p className="text-bioluminescent text-sm mb-1">{person.title}</p>
       <p className="text-white/50 text-sm">{person.affiliation}</p>
     </motion.div>
   );
 
   return (
     <section
       id="team"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(220 95% 15%) 0%, hsl(222 95% 12%) 100%)",
       }}
     >
       <JellyfishGroup count={3} />
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-12"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Judges & Mentors
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Learn from alumni, faculty, & industry experts to get guidance throughout the hackathon.
           </p>
         </motion.div>
 
         <Tabs defaultValue="judges" className="w-full">
           <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/10 mb-12">
             <TabsTrigger value="judges" className="data-[state=active]:bg-bioluminescent data-[state=active]:text-deep-water">
               Judges
             </TabsTrigger>
             <TabsTrigger value="mentors" className="data-[state=active]:bg-bioluminescent data-[state=active]:text-deep-water">
               Mentors
             </TabsTrigger>
           </TabsList>
 
           <TabsContent value="judges">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
              //  className="grid sm:grid-cols-2 md:grid-cols-4 gap-6"
              className="flex justify-center"
             >
               {judges.map((judge, index) => (
                 <motion.div
                   key={judge.name}
                   initial={{ opacity: 0, y: 20 }}
                   animate={isInView ? { opacity: 1, y: 0 } : {}}
                   transition={{ duration: 0.4, delay: index * 0.1 }}
                 >
                   <PersonCard person={judge} />
                 </motion.div>
               ))}
             </motion.div>
           </TabsContent>
 
           <TabsContent value="mentors">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
              //  className="grid sm:grid-cols-2 md:grid-cols-3 gap-6"
              className="flex justify-center"
             >
               {mentors.map((mentor, index) => (
                 <motion.div
                   key={mentor.name}
                   initial={{ opacity: 0, y: 20 }}
                   animate={isInView ? { opacity: 1, y: 0 } : {}}
                   transition={{ duration: 0.4, delay: index * 0.1 }}
                 >
                   <PersonCard person={mentor} />
                 </motion.div>
               ))}
             </motion.div>
           </TabsContent>
         </Tabs>
       </div>

       <motion.p
           initial={{ opacity: 0 }}
           animate={isInView ? { opacity: 1 } : {}}
           transition={{ duration: 0.5, delay: 0.5 }}
           className="text-2xl text-center text-white/60 mt-12"
         >
           Interested in mentoring or judging?{" "}
           <a href="mailto:ds3@ucsd.edu" className="text-accent hover:underline">
             Contact us
           </a>
         </motion.p>
     </section>
   );
 };
 
 export default TeamSection;