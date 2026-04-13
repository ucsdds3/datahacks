import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useJudgesAndMentors,
  type TeamMember,
} from "@/hooks/useJudgesAndMentors";
import { JellyfishGroup } from "../animations/Jellyfish";

const keynoteSpeakers: TeamMember[] = [
  {
    id: "sharad-agarwal",
    name: "Sharad Agarwal",
    title: "Head of Global Partnerships",
    affiliation: "Google",
    imageSrc: "/keynotes/sharad.png",
  },
  {
    id: "ali-arsanjani",
    name: "Ali Arsanjani",
    title: "Director of Applied AI",
    affiliation: "Google",
    imageSrc: "/keynotes/ali.png",
  },
  // {
  //   id: "ian-kerman",
  //   name: "Ian Kerman",
  //   title: "Senior Developer Relations Manager",
  //   affiliation: "NVIDIA",
  //   logoSrc: "/judges/nvidia.png",
  // },
];

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const TeamSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [showAllKeynotes, setShowAllKeynotes] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAllMentors, setShowAllMentors] = useState(false);
  const { data, isLoading, isError } = useJudgesAndMentors();

  const PersonCard = ({
    person,
    featured = false,
  }: {
    person: TeamMember;
    featured?: boolean;
  }) => {
    const [showLogo, setShowLogo] = useState(Boolean(person.logoSrc));
    const hasHeadshot = Boolean(person.imageSrc);

    return (
      <motion.div
        whileHover={{ y: -5 }}
        className={`bg-white/5 backdrop-blur-md rounded-2xl border border-bioluminescent/20 text-center group ${
          featured ? "p-8 md:p-10" : "p-6"
        }`}
      >
        <div
          className={`mx-auto rounded-full flex items-center justify-center overflow-hidden bg-white/80 border border-white/15 group-hover:shadow-lg group-hover:shadow-bioluminescent/30 transition-shadow ${
            featured ? "w-40 h-40 mb-6" : "w-20 h-20 mb-4"
          }`}
        >
          {person.imageSrc ? (
            <img
              src={person.imageSrc}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          ) : !hasHeadshot && showLogo && person.logoSrc ? (
            <img
              src={person.logoSrc}
              alt={person.affiliation}
              className="w-3/4 h-3/4 object-contain"
              onError={() => setShowLogo(false)}
            />
          ) : (
            <span className="font-display text-2xl font-bold">
              {getInitials(person.name)}
            </span>
          )}
        </div>

        <h4
          className={`font-display font-bold text-white mb-1 ${
            featured ? "text-2xl" : "text-lg"
          }`}
        >
          {person.name}
        </h4>

        <p className={featured ? "text-bioluminescent text-base mb-2" : "text-bioluminescent text-sm mb-1"}>
          {person.title}
        </p>

        <p className={featured ? "text-white/60 text-base" : "text-white/50 text-sm"}>
          {person.affiliation}
        </p>
      </motion.div>
    );
  };

  const LoadingGrid = () => (
    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-bioluminescent/20"
        >
          <Skeleton className="w-20 h-20 rounded-full mx-auto mb-4 bg-white/10" />
          <Skeleton className="h-5 w-3/4 mx-auto mb-2 bg-white/10" />
          <Skeleton className="h-4 w-2/3 mx-auto mb-2 bg-white/10" />
          <Skeleton className="h-4 w-1/2 mx-auto bg-white/10" />
        </div>
      ))}
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/70">
      No {label.toLowerCase()} are listed yet. Check back soon.
    </div>
  );

  const ErrorState = () => (
    <div className="rounded-2xl border border-coral/30 bg-coral/10 px-6 py-10 text-center text-white/80">
      We couldn&apos;t load the latest judges and mentors right now.
    </div>
  );

  const PersonGrid = ({
    people,
    label,
    showAllPeople,
    setShowAllPeople,
    deferToRosterState = true,
    centered = false,
    featuredCards = false,
  }: {
    people: TeamMember[];
    label: string;
    showAllPeople: boolean;
    setShowAllPeople: (value: boolean) => void;
    deferToRosterState?: boolean;
    centered?: boolean;
    featuredCards?: boolean;
  }) => {
    if (deferToRosterState && isLoading) {
      return <LoadingGrid />;
    }

    if (deferToRosterState && isError) {
      return <ErrorState />;
    }

    if (people.length === 0) {
      return <EmptyState label={label} />;
    }

    const visiblePeople = showAllPeople ? people : people.slice(0, 8);

    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={
            centered
              ? "flex flex-wrap justify-center gap-6"
              : "grid gap-6 sm:grid-cols-2 md:grid-cols-4"
          }
        >
          {visiblePeople.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={
                centered
                  ? featuredCards
                    ? "w-full max-w-md lg:w-[min(30rem,calc(50%-0.75rem))]"
                    : "w-full sm:max-w-sm lg:w-[calc(25%-1.125rem)]"
                  : undefined
              }
            >
              <PersonCard person={person} featured={featuredCards} />
            </motion.div>
          ))}
        </motion.div>

        {people.length > 8 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowAllPeople(!showAllPeople)}
              className="px-6 py-2 rounded-full border border-bioluminescent/40 text-bioluminescent hover:bg-bioluminescent/10 transition-colors text-sm font-medium"
            >
              {showAllPeople ? "Show Less ↑" : `Show ${people.length - 8} More ↓`}
            </button>
          </div>
        )}
      </>
    );
  };
 
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
             Speakers, Judges, & Mentors
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Hear from industry leaders, then connect with alumni, faculty, and experts throughout the hackathon.
           </p>
         </motion.div>
 
         <Tabs defaultValue="keynote-speakers" className="w-full">
           <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 bg-white/10 mb-12">
             <TabsTrigger value="keynote-speakers" className="data-[state=active]:bg-bioluminescent data-[state=active]:text-deep-water">
               Keynote Speakers ({keynoteSpeakers.length})
             </TabsTrigger>
             <TabsTrigger value="judges" className="data-[state=active]:bg-bioluminescent data-[state=active]:text-deep-water">
               Judges{data ? ` (${data.judges.length})` : ""}
             </TabsTrigger>
             <TabsTrigger value="mentors" className="data-[state=active]:bg-bioluminescent data-[state=active]:text-deep-water">
               Mentors{data ? ` (${data.mentors.length})` : ""}
             </TabsTrigger>
           </TabsList>

           <TabsContent value="keynote-speakers">
             <PersonGrid
               people={keynoteSpeakers}
               label="Keynote Speakers"
               showAllPeople={showAllKeynotes}
               setShowAllPeople={setShowAllKeynotes}
               deferToRosterState={false}
               centered
               featuredCards
             />
           </TabsContent>
 
           <TabsContent value="judges">
             <PersonGrid
               people={data?.judges ?? []}
               label="Judges"
               showAllPeople={showAll}
               setShowAllPeople={setShowAll}
             />
           </TabsContent>
 
           <TabsContent value="mentors">
             <PersonGrid
               people={data?.mentors ?? []}
               label="Mentors"
               showAllPeople={showAllMentors}
               setShowAllPeople={setShowAllMentors}
             />
           </TabsContent>
         </Tabs>
       </div>

       <motion.p
           initial={{ opacity: 0 }}
           animate={isInView ? { opacity: 1 } : {}}
           transition={{ duration: 0.5, delay: 0.5 }}
           className="text-2xl text-center text-white/60 mt-12"
         >
           {/* Interested in mentoring or judging?{" "} */}
           We have hit our mentor & judge capacity.{" "}
           <a href="mailto:ds3@ucsd.edu" className="text-accent hover:underline">
             Contact us
           </a>
         </motion.p>
     </section>
   );
 };
 
 export default TeamSection;
