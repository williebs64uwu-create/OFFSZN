
import React from 'react';

const Testimonials: React.FC = () => {
    return (
        <section className="py-16 md:py-24" id="testimonios">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12">
                    <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">💬 LO QUE DICEN</span>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight">Historias Reales</h2>
                </div>
                <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/30 rounded-2xl p-8 sm:p-12 text-center">
                    <img 
                        src="https://picsum.photos/seed/producer/200/200" 
                        alt="Producer" 
                        className="w-24 h-24 rounded-full border-4 border-[#A429FF] mx-auto mb-6 object-cover"
                    />
                    <p className="text-lg sm:text-xl text-purple-200/90 leading-relaxed italic mb-6">
                        "Gracias a OFFSZN pude vender mi primer beat a un artista internacional. La plataforma es súper fácil de usar y los pagos llegan al instante."
                    </p>
                    <h4 className="text-xl font-bold text-white">J Wolf La Bestia</h4>
                    <p className="text-sm text-purple-200/80 mb-6">Artista · Lima, Perú</p>
                    <div className="flex gap-4 justify-center">
                        <a href="#" className="w-10 h-10 flex items-center justify-center bg-[#A429FF]/20 border border-[#A429FF]/40 rounded-full text-[#D69CFF] hover:bg-[#A429FF]/40 hover:text-white transition-all duration-300 hover:-translate-y-0.5"><i className="bi bi-instagram"></i></a>
                        <a href="#" className="w-10 h-10 flex items-center justify-center bg-[#A429FF]/20 border border-[#A429FF]/40 rounded-full text-[#D69CFF] hover:bg-[#A429FF]/40 hover:text-white transition-all duration-300 hover:-translate-y-0.5"><i className="bi bi-spotify"></i></a>
                        <a href="#" className="w-10 h-10 flex items-center justify-center bg-[#A429FF]/20 border border-[#A429FF]/40 rounded-full text-[#D69CFF] hover:bg-[#A429FF]/40 hover:text-white transition-all duration-300 hover:-translate-y-0.5"><i className="bi bi-tiktok"></i></a>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
