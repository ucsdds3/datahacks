 import { motion } from "framer-motion";
 import { useInView } from "framer-motion";
 import { useRef } from "react";
 import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
 } from "@/components/ui/accordion";
 
 const FAQSection = () => {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const faqs = [
    {
      question: "Who hosts DataHacks?",
      answer: "DataHacks has been annually hosted for several years by the Data Science Student Society (DS3), welcoming ~250 UCSD undergraduates. This year, we are excited to partner with Triton Quantitative Trading (TQT), Google Developer Group on Campus (GDG), AWS Cloud Club, Startup Incubator Club, and the Biomedical Engineering Society to bring an even bigger and better hackathon experience for 400 undergraduates and graduates from any university!",
    },
     {
       question: "Who can participate in DataHacks?",
       answer: "DataHacks is open to all undergraduate and graduate students from any university. No prior hackathon experience is required, we welcome beginners and experts alike!",
     },
     {
       question: "How much does it cost to participate?",
       answer: "DataHacks is completely free! We provide meals, snacks, swag, and all the resources you need for 24 hours of hacking. For students traveling from outside San Diego, we also offer limited travel reimbursement. Apply for reimbursement in your registration.",
     },
     {
      question: "Is it overnight?",
      answer: "Yes! DataHacks is a 36-hour overnight hackathon. The event starts in the morning of the first day and ends in the afternoon of the second day, with awards and closing ceremonies immediately following. We provide a safe and comfortable environment for all participants to hack through the night, including a designated quiet area for rest.",
    },
     {
       question: "What should I bring?",
       answer: "Bring your laptop, charger, student ID, and anything you need to be comfortable overnight (pillow, blanket, etc.). We'll provide everything else!",
     },
     {
       question: "Do I need a team?",
       answer: "Teams can have 1-4 members. You can come with a team or find teammates at our team formation event at the start of the hackathon.",
     },
     {
      question: "Where can I meet people to form a team?",
      answer: "We will be hosting a mixer the day before DataHacks to provide an open space for people to network and form teams. There will also be time during breakfast on the first day of the event to meet new people and join a team.",
    },
     {
       question: "What if I don't know how to code?",
       answer: "That's okay! DataHacks is a learning experience. We have workshops, mentors, and resources before and during the event to help you learn. Many successful projects involve design, research, and presentation skills.",
     },
     {
      question: "Will specific hardware be provided for the hardware track?",
      answer: "Yes, our sponsors have provided us with hardware to hand out to teams interested in the hardware track. We will have a limited number of kits available, so be sure to indicate your interest in the hardware track when you register. Please note that we may not have the specific hardware you need and that our inventory is limited. Hardware will be distributed on a first-come, first-served basis at the start of the hackathon and will be returned at the end of the event. Winning teams can keep their kits!",
    },
     {
       question: "What are the judging criteria?",
       answer: "Projects are judged on innovation, technical complexity, impact on the theme (energy/climate/environment), and presentation quality. Exact rubrics will be revealed later.",
     },
     {
       question: "Will there be travel reimbursement?",
       answer: "We offer limited travel reimbursement for students traveling from outside San Diego. Apply for reimbursement in your registration.",
     },
     {
       question: "What if I have dietary restrictions?",
       answer: "We will be providing a variety of meals and snacks throughout the event, including vegetarian, vegan, and gluten-free options. Please indicate any dietary restrictions in your registration form so we can accommodate you. In case our accomodations are not suitable, you are also welcome to bring your own food and snacks to the event. We also have a Target on-campus and many nearby restaurants if you want to order food during the event.",
     },
     {
      question: "Is there parking? Public transportation?",
      answer: "There are several parking lots on campus that you can use for the event. We recommend parking in the Theater District, Hopkins, or Gilman Parking Structures, which are ~10 minute walks from the event venue. Please note that parking costs money and can fill up quickly. We reccomend utilizing cheap public transportation options like the Coaster, MTS buses, Blue-Line Trolley, or ridesharing services. If you are traveling from outside San Diego and need parking, please indicate this in your registration form and we will do our best to accomodate you.",
    },
   ];
 
   return (
     <section
       id="faq"
       ref={ref}
       className="relative py-24 md:py-32 overflow-hidden"
       style={{
         background: "linear-gradient(180deg, hsl(222 95% 12%) 0%, hsl(224 95% 10%) 100%)",
       }}
     >
       {/* Particle effect */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         {[...Array(30)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute w-0.5 h-0.5 rounded-full bg-bioluminescent/50"
             style={{
               left: `${Math.random() * 100}%`,
               top: `${Math.random() * 100}%`,
             }}
             animate={{
               opacity: [0, 0.5, 0],
               y: [0, -20, 0],
             }}
             transition={{
               duration: 3 + Math.random() * 2,
               repeat: Infinity,
               delay: Math.random() * 3,
             }}
           />
         ))}
       </div>
 
       <div className="container mx-auto px-4 relative z-10">
         <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6 }}
           className="text-center mb-12"
         >
           <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
             Frequently Asked Questions
           </h2>
           <p className="text-xl text-white/80 max-w-2xl mx-auto">
             Got questions? We've got answers!
           </p>
         </motion.div>
 
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={isInView ? { opacity: 1, y: 0 } : {}}
           transition={{ duration: 0.6, delay: 0.2 }}
           className="max-w-3xl mx-auto"
         >
           <Accordion type="single" collapsible className="space-y-4">
             {faqs.map((faq, index) => (
               <AccordionItem
                 key={index}
                 value={`item-${index}`}
                 className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 px-6 data-[state=open]:border-bioluminescent/30"
               >
                 <AccordionTrigger className="text-xl text-white hover:text-bioluminescent hover:no-underline py-5 text-left">
                   {faq.question}
                 </AccordionTrigger>
                 <AccordionContent className="text-lg text-white/70 pb-5">
                   {faq.answer}
                 </AccordionContent>
               </AccordionItem>
             ))}
           </Accordion>
         </motion.div>
       </div>
     </section>
   );
 };
 
 export default FAQSection;