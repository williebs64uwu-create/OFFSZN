
import React, { useRef, useEffect, useState } from 'react';

const creators = [
  { name: 'Nicki Minaj', seed: 'nicki' },
  { name: 'KSI', seed: 'ksi' },
  { name: 'French Montana', seed: 'montana' },
  { name: 'Marshmello', seed: 'mello' },
  { name: 'Bad Bunny', seed: 'bunny' },
  { name: 'Drake', seed: 'drake' },
  { name: 'Roddy Ricch', seed: 'roddy' },
  { name: 'Travis Scott', seed: 'travis' },
  { name: 'Post Malone', seed: 'post' },
  { name: 'Lil Uzi Vert', seed: 'uzi' },
  { name: 'The Weeknd', seed: 'weeknd' },
  { name: 'Cardi B', seed: 'cardi' },
  { name: 'Future', seed: 'future' },
  { name: 'Migos', seed: 'migos' },
  { name: '21 Savage', seed: 'savage' },
];

const CreatorsCarousel: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const checkScroll = () => {
        if (containerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
            checkScroll(); // Initial check
        }
        return () => {
            if (container) {
                container.removeEventListener('scroll', checkScroll);
                window.removeEventListener('resize', checkScroll);
            }
        };
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (containerRef.current) {
            const scrollAmount = direction === 'left' ? -300 : 300;
            containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section className="py-16 md:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-10">
                    <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">COMUNIDAD GLOBAL</span>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight mb-4">Creadores Originales</h2>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto">Los sonidos de nuestros productores han sido usados por los nombres más grandes de la industria.</p>
                </div>
                
                <div className="relative mt-12">
                    <button 
                        onClick={() => scroll('left')}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-gradient-to-r from-[#A429FF] to-[#7A1FBF] text-white rounded-full flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-[#A429FF]/50 ${canScrollLeft ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
                    >
                        <i className="bi bi-chevron-left"></i>
                    </button>
                    
                    <div 
                        ref={containerRef}
                        id="creators-container"
                        className="flex gap-8 overflow-x-auto scrollbar-hide scroll-smooth px-12"
                    >
                        {creators.map(creator => (
                            <div key={creator.name} className="flex flex-col items-center gap-4 text-center flex-shrink-0 w-28">
                                <img src={`https://picsum.photos/seed/${creator.seed}/128/128`} alt={creator.name} className="w-28 h-28 rounded-full object-cover border-4 border-white/10 shadow-lg" />
                                <span className="font-bold text-white text-md">{creator.name}</span>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => scroll('right')}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-gradient-to-r from-[#A429FF] to-[#7A1FBF] text-white rounded-full flex items-center justify-center transition-all duration-300 hover:shadow-lg hover:shadow-[#A429FF]/50 ${canScrollRight ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}
                    >
                        <i className="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        </section>
    );
};

export default CreatorsCarousel;
