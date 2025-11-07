
import React, { useState, useEffect } from 'react';

const CountdownBanner: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 30,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  
  if (!isVisible) return null;

  return (
    <div id="countdown-banner" className="bg-gradient-to-r from-[#A429FF] to-[#7A1FBF] p-2 flex items-center justify-center relative z-[1001] border-b border-white/10">
      <div className="flex items-center justify-center gap-4 sm:gap-6 max-w-7xl w-full px-4 sm:px-6 flex-wrap">
        <span className="text-white text-xs font-bold tracking-wider uppercase text-center">🎁 ¡REGÍSTRATE AHORA Y RECIBE $5 USD GRATIS!</span>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center bg-black/30 px-2 py-1.5 rounded min-w-[40px]">
            <span id="days" className="text-white text-base font-extrabold leading-none">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="text-white/70 text-[0.5rem] uppercase tracking-widest">day</span>
          </div>
          <div className="flex flex-col items-center bg-black/30 px-2 py-1.5 rounded min-w-[40px]">
            <span id="hours" className="text-white text-base font-extrabold leading-none">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-white/70 text-[0.5rem] uppercase tracking-widest">hou</span>
          </div>
          <div className="flex flex-col items-center bg-black/30 px-2 py-1.5 rounded min-w-[40px]">
            <span id="minutes" className="text-white text-base font-extrabold leading-none">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-white/70 text-[0.5rem] uppercase tracking-widest">min</span>
          </div>
          <div className="flex flex-col items-center bg-black/30 px-2 py-1.5 rounded min-w-[40px]">
            <span id="seconds" className="text-white text-base font-extrabold leading-none">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-white/70 text-[0.5rem] uppercase tracking-widest">sec</span>
          </div>
        </div>
        <a href="#register" className="bg-black text-white px-5 py-2 rounded-md text-xs font-bold tracking-wider uppercase transition-all duration-300 border border-white/20 hover:bg-black/80 hover:border-white hover:-translate-y-0.5">Reclamar Bonificación</a>
      </div>
      <button onClick={() => setIsVisible(false)} className="absolute right-4 sm:right-6 text-white/70 text-2xl hover:text-white transition-colors">×</button>
    </div>
  );
};

export default CountdownBanner;
