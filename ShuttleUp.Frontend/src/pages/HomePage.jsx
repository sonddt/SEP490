import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Component imports
import HeroSection from '../components/home/HeroSection';
import WorkSection from '../components/home/WorkSection';
import FeaturedVenues from '../components/home/FeaturedVenues';
import Services from '../components/home/Services';
import ConvenientSection from '../components/home/ConvenientSection';
import FeaturedCoaches from '../components/home/FeaturedCoaches';
import JourneySection from '../components/home/JourneySection';
import FeaturesSection from '../components/home/FeaturesSection';
import EarnMoneySection from '../components/home/EarnMoneySection';
import StatsCounter from '../components/home/StatsCounter';
import CourtsNearYou from '../components/home/CourtsNearYou';
import Testimonials from '../components/home/Testimonials';
import FeaturedPlan from '../components/home/FeaturedPlan';

export default function HomePage() {
  useEffect(() => {
    // Small delay ensures DOM is fully painted before AOS measures elements
    const timer = setTimeout(() => {
      AOS.init({
        duration: 800,
        once: true,
        offset: 80,
        easing: 'ease-in-out',
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="main-wrapper">
      <HeroSection />
      <WorkSection />
      <FeaturedVenues />
      <Services />
      <ConvenientSection />
      <FeaturedCoaches />
      <JourneySection />
      <FeaturesSection />
      <EarnMoneySection />
      <StatsCounter />
      <CourtsNearYou />
      <Testimonials />
      <FeaturedPlan />
    </div>
  );
}
