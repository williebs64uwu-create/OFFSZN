
import React from 'react';
import CountdownBanner from './components/CountdownBanner';
import Header from './components/Header';
import Hero from './components/Hero';
import CreatorsCarousel from './components/CreatorsCarousel';
import InteractiveDemo from './components/InteractiveDemo';
import Beats from './components/Beats';
import WhyOffszn from './components/WhyOffszn';
import Testimonials from './components/Testimonials';
import FAQ from './components/FAQ';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <>
      <CountdownBanner />
      <Header />
      <main>
        <Hero />
        <InteractiveDemo />
        <Beats />
        <WhyOffszn />
        <Testimonials />
        <CreatorsCarousel />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
};

export default App;
