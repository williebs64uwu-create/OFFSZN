
import React from 'react';

const WhyOffszn: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">💜 ¿POR QUÉ OFFSZN?</span>
          <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight">No es solo un marketplace.<br />Es tu comunidad.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: "Hecho en Perú" - Centered Content */}
          <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-8 transition-all duration-300 hover:border-[#A429FF]/60 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#A429FF]/30 text-center">
            <div className="h-[56px] flex items-center justify-center mb-4 text-5xl font-bold tracking-tighter text-purple-200/80">PE</div>
            <h3 className="text-2xl font-bold text-white mb-3">Hecho en Perú, para el mundo</h3>
            <p className="text-purple-200/80">La primera plataforma donde productores peruanos venden su música globalmente.</p>
          </div>
          {/* Card 2: "Pagos locales" - Centered Content */}
          <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-8 transition-all duration-300 hover:border-[#A429FF]/60 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#A429FF]/30 text-center">
            <div className="h-[56px] flex items-center justify-center mb-4">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g>
                      <path d="M8 24C8 23.4477 8.44772 23 9 23H32C32.5523 23 33 23.4477 33 24V32C33 32.5523 32.5523 33 32 33H9C8.44772 33 8 32.5523 8 32V24Z" fill="#10B981"/>
                      <path d="M12 20C12 19.4477 12.4477 19 13 19H35C35.5523 19 36 19.4477 36 20V28C36 28.5523 35.5523 29 35 29H33V32C33 32.5523 32.5523 33 32 33H13C12.4477 33 12 32.5523 12 32V20Z" fill="#34D399"/>
                      <circle cx="24" cy="24" r="3" fill="white"/>
                      <text x="22.5" y="26.5" fill="#10B981" fontSize="5" fontWeight="bold">$</text>
                      <path d="M36 19L44 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M36 29L44 33" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </g>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Pagos locales sin complicaciones</h3>
            <p className="text-purple-200/80">Cobra en soles con Yape o dólares con PayPal. Sin restricciones, sin demoras.</p>
          </div>
          {/* Card 3: "Comunidad integrada" - Centered Content */}
          <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-8 transition-all duration-300 hover:border-[#A429FF]/60 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#A429FF]/30 text-center">
            <div className="h-[56px] flex items-center justify-center mb-4">
               <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g>
                      <circle cx="30" cy="15" r="5" fill="#C4B5FD"/>
                      <path d="M38 36V32C38 29.2386 34.4183 27 30 27C25.5817 27 22 29.2386 22 32V36H38Z" fill="#C4B5FD"/>
                      <circle cx="18" cy="17" r="6" fill="#A429FF"/>
                      <path d="M28 36V31C28 27.134 23.5228 24 18 24C12.4772 24 8 27.134 8 31V36H28Z" fill="#A429FF"/>
                  </g>
                </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Comunidad integrada</h3>
            <p className="text-purple-200/80">Foros, Discord activo, colaboraciones. Esto no es mío, es de todos nosotros.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyOffszn;
