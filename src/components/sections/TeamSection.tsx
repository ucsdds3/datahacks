import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef, useState } from "react";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { JellyfishGroup } from "../animations/Jellyfish";
 
 const TeamSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
   const [showAll, setShowAll] = useState(false);
   const [showAllMentors, setShowAllMentors] = useState(false);

   const judges = [
    {
      name: "Ishita Verma",
      title: "Senior MLE",
      affiliation: "Neflix",
      image: "/judges/netflix.png",
    },
    {
      name: "Allan Sun",
      title: "SWE",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Gayathri Nallore",
      title: "Senior TPM",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Asif Amanullah",
      title: "Senior Data Engineer",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Manoj Mohan",
      title: "SDE",
      affiliation: "Amazon",
      image: "/judges/amazon.png",
    },
    {
      name: "Chelsea Fernanades",
      title: "SDE",
      affiliation: "Amazon",
      image: "/judges/amazon.png",
    },
    {
      name: "Ngoc Doan",
      title: "SWE",
      affiliation: "DoorDash",
      image: "/judges/doordash.png",
    },
    {
      name: "Aditya Mallajosyula",
      title: "Member of Technical Staff",
      affiliation: "Oracle",
      image: "/judges/oracle.png",
    },
    {
      name: "Manushi Seth",
      title: "Engineering Manager",
      affiliation: "Sonos",
      image: "/judges/sonos.png",
    },
    {
      name: "Anishek Kamal",
      title: "Data + AI Architect",
      affiliation: "Microsoft + Toya AI",
      image: "/judges/microsoft.png",
    },
    {
      name: "Bhargav Piduru",
      title: "Senior SWE",
      affiliation: "Hyundai",
      image: "/judges/hyundai.png",
    },
    {
      name: "Stella Li",
      title: "Lead PM",
      affiliation: "BILL",
      image: "/judges/bill.png",
    },
   ];
 
   const mentors = [
    {
      name: "Juan Saldarriaga",
      title: "Senior Computational Designer",
      affiliation: "Google",
      image: "/judges/google.png",
    },
    {
      name: "Jyothi Vaidyanathan",
      title: "Workday Integration Engineer",
      affiliation: "Google",
      image: "/judges/lyft.png",
    },
    {
      name: "Ishita Verma",
      title: "Senior MLE",
      affiliation: "Neflix",
      image: "/judges/netflix.png",
    },
    {
      name: "Allan Sun",
      title: "SWE",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Gayathri Nallore",
      title: "Senior TPM",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Asif Amanullah",
      title: "Senior Data Engineer",
      affiliation: "Apple",
      image: "/judges/apple.png",
    },
    {
      name: "Manoj Mohan",
      title: "SDE",
      affiliation: "Amazon",
      image: "/judges/amazon.png",
    },
    {
      name: "Chelsea Fernanades",
      title: "SDE",
      affiliation: "Amazon",
      image: "/judges/amazon.png",
    },
    {
      name: "Ngoc Doan",
      title: "SWE",
      affiliation: "DoorDash",
      image: "/judges/doordash.png",
    },
    {
      name: "Aditya Mallajosyula",
      title: "Member of Technical Staff",
      affiliation: "Oracle",
      image: "/judges/oracle.png",
    },
    {
      name: "Manushi Seth",
      title: "Engineering Manager",
      affiliation: "Sonos",
      image: "/judges/sonos.png",
    },
    {
      name: "Anishek Kamal",
      title: "Data + AI Architect",
      affiliation: "Microsoft + Toya AI",
      image: "/judges/microsoft.png",
    },
    {
      name: "Bhargav Piduru",
      title: "Senior SWE",
      affiliation: "Hyundai",
      image: "/judges/hyundai.png",
    },
    {
      name: "Stella Li",
      title: "Lead PM",
      affiliation: "BILL",
      image: "/judges/bill.png",
    },
   ];
 
   const PersonCard = ({ person }: { person: typeof judges[0] }) => (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-bioluminescent/20 text-center group"
    >
      <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 overflow-hidden bg-white/80 group-hover:shadow-lg group-hover:shadow-bioluminescent/30 transition-shadow">
        {typeof person.image === "string" && person.image.startsWith("/") ? (
          <img
            src={person.image}
            alt={person.name}
            className="w-3/4 h-3/4 object-contain"
          />
        ) : (
          <span className="text-4xl">{person.image}</span>
        )}
      </div>
  
      <h4 className="font-display text-lg font-bold text-white mb-1">
        {person.name}
      </h4>
  
      <p className="text-bioluminescent text-sm mb-1">
        {person.title}
      </p>
  
      <p className="text-white/50 text-sm">
        {person.affiliation}
      </p>
    </motion.div>
  );

  const PersonGrid = ({
    people,
    showAll,
    setShowAll,
  }: {
    people: typeof judges;
    showAll: boolean;
    setShowAll: (val: boolean) => void;
  }) => (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid sm:grid-cols-2 md:grid-cols-4 gap-6"
      >
        {(showAll ? people : people.slice(0, 8)).map((person, index) => (
          <motion.div
            key={person.name}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <PersonCard person={person} />
          </motion.div>
        ))}
      </motion.div>

      {people.length > 8 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-6 py-2 rounded-full border border-bioluminescent/40 text-bioluminescent hover:bg-bioluminescent/10 transition-colors text-sm font-medium"
          >
            {showAll ? "Show Less ↑" : `Show ${people.length - 8} More ↓`}
          </button>
        </div>
      )}
    </>
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
             <PersonGrid people={judges} showAll={showAll} setShowAll={setShowAll} />
           </TabsContent>
 
           <TabsContent value="mentors">
             <PersonGrid people={mentors} showAll={showAllMentors} setShowAll={setShowAllMentors} />
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