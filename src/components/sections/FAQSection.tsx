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
       question: "Who can participate in DataHacks?",
       answer: "DataHacks is open to all undergraduate and graduate students from any university. No prior hackathon experience is required – we welcome beginners and experts alike!",
     },
     {
       question: "How much does it cost to participate?",
       answer: "DataHacks is completely free! We provide meals, snacks, swag, and all the resources you need for 24 hours of hacking.",
     },
     {
       question: "What should I bring?",
       answer: "Bring your laptop, charger, student ID, and anything you need to be comfortable (pillow, blanket, etc.). We'll provide everything else!",
     },
     {
       question: "Do I need a team?",
       answer: "Teams can have 1-4 members. You can come with a team or find teammates at our team formation event at the start of the hackathon.",
     },
     {
       question: "What if I don't know how to code?",
       answer: "That's okay! DataHacks is a learning experience. We have workshops, mentors, and resources to help you learn. Many successful projects involve design, research, and presentation skills too.",
     },
     {
       question: "What are the judging criteria?",
       answer: "Projects are judged on innovation, technical complexity, impact on the theme (energy/climate/environment), and presentation quality.",
     },
     {
       question: "Will there be travel reimbursement?",
       answer: "We offer limited travel reimbursement for students traveling from outside San Diego. Apply for reimbursement in your registration.",
     },
     {
       question: "What COVID-19 precautions are in place?",
       answer: "We follow UC San Diego's health guidelines. Please check our website closer to the event for the latest safety protocols.",
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
                 <AccordionTrigger className="text-white hover:text-bioluminescent hover:no-underline py-5 text-left">
                   {faq.question}
                 </AccordionTrigger>
                 <AccordionContent className="text-white/70 pb-5">
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