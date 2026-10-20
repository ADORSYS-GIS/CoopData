import { useRef } from "react";

import { Announcements } from "@/components/landing/Announcements";
import { Capabilities } from "@/components/landing/Capabilities";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Mission } from "@/components/landing/Mission";
import { PartnerStrip } from "@/components/landing/PartnerStrip";
import { Sectors } from "@/components/landing/Sectors";
import { useScrollReveal } from "@/hooks/landing/useScrollReveal";

export const LandingPage: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  return (
    <div ref={rootRef} className="landing-page min-h-dvh bg-background text-foreground">
      <LandingHeader />
      <main>
        <Hero />
        <PartnerStrip />
        <Mission />
        <HowItWorks />
        <Sectors />
        <Capabilities />
        <Announcements />
        <Faq />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};
