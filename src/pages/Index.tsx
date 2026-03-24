import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import TimelineSection from "@/components/sections/TimelineSection";
import TracksSection from "@/components/sections/TracksSection";
import ChallengesSection from "@/components/sections/ChallengesSection";
import PrizesSection from "@/components/sections/PrizesSection";
import SponsorsSection from "@/components/sections/SponsorsSection";
import TeamSection from "@/components/sections/TeamSection";
import FAQSection from "@/components/sections/FAQSection";
import ContactSection from "@/components/sections/ContactSection";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <AboutSection />
      <TimelineSection />
      <TracksSection />
      <PrizesSection />
      <ChallengesSection />
      <SponsorsSection />
      <TeamSection />
      <FAQSection />
      <ContactSection />
    </div>
  );
};

export default Index;
