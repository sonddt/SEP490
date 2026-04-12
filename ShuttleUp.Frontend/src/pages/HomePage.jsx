import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';

import HeroSection from '../components/home/HeroSection';
import FeaturedVenues from '../components/home/FeaturedVenues';
import WorkSection from '../components/home/WorkSection';
import Services from '../components/home/Services';

export default function HomePage() {
  useEffect(() => {
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
      <FeaturedVenues />
      <WorkSection />
      <Services />
    </div>
  );
}
