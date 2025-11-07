
import React from 'react';

const Hero: React.FC = () => {
  return (
    <section id="inicio" className="min-h-[80vh] flex items-center py-16 md:py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="flex flex-col gap-6 text-center lg:text-left items-center lg:items-start">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#A429FF]/15 border border-[#A429FF]/40 rounded-full text-sm font-bold text-[#D69CFF] tracking-wider uppercase">
            🇵🇪 100% Peruano • Beta Abierta
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[0.95] tracking-tighter text-white uppercase font-montserrat">
            El Primer<br />
            <span className="bg-gradient-to-r from-[#A429FF] to-[#D69CFF] text-transparent bg-clip-text">Marketplace</span><br />
            Musical de Perú
          </h1>
          <p className="text-lg text-purple-200/90 max-w-md">Donde productores peruanos venden beats, kits y presets al mundo entero.</p>
          <div className="flex gap-4 flex-wrap justify-center lg:justify-start">
            <div className="flex items-center gap-3 px-4 py-2 bg-[#A429FF]/10 border border-[#A429FF]/30 rounded-xl">
              <span className="text-2xl font-bold text-white font-montserrat">+100</span>
              <span className="text-sm text-gray-400 uppercase">Productores</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-[#A429FF]/10 border border-[#A429FF]/30 rounded-xl">
              <span className="text-2xl font-bold text-white font-montserrat">+500</span>
              <span className="text-sm text-gray-400 uppercase">Descargas</span>
            </div>
             <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#A429FF]/10 border border-[#A429FF]/30 rounded-xl">
              <span className="text-2xl font-bold text-white font-montserrat">5.0</span>
              <span className="text-sm text-gray-400 uppercase">Valoración</span>
            </div>
          </div>
          <div className="flex gap-4 mt-4 flex-wrap justify-center lg:justify-start">
            <a href="#beats" className="px-8 py-4 rounded-xl text-white font-bold bg-gradient-to-r from-[#A429FF] to-[#7A1FBF] transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#A429FF]/40 flex items-center gap-2">Explorar Recursos <i className="bi bi-arrow-right"></i></a>
            <a href="#demo" className="px-8 py-4 rounded-xl text-white font-bold bg-transparent border-2 border-white/20 transition hover:bg-white/5 hover:border-white/40 flex items-center gap-2">Empezar a Vender <i className="bi bi-upload"></i></a>
          </div>
        </div>
        <div className="hero-image">
          <img src="https://picsum.photos/seed/musicprod/600/600" alt="OFFSZN Platform" className="rounded-2xl shadow-2xl shadow-[#A429FF]/30 w-full" />
        </div>
      </div>
    </section>
  );
};

export default Hero;
