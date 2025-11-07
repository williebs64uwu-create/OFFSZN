
import React, { useState } from 'react';

const BeatCard = ({ title, producer, price, bpm, seed }: { title: string, producer: string, price: number, bpm: number, seed: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#A429FF]/60 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#A429FF]/30">
            <div className="relative aspect-video bg-cover bg-center" style={{backgroundImage: `url(https://picsum.photos/seed/${seed}/400/225)`}}>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-white/95 rounded-full flex items-center justify-center text-3xl text-[#A429FF] cursor-pointer transition-transform duration-300 hover:scale-110 shadow-lg">
                        <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                    </button>
                </div>
            </div>
            <div className="p-5">
                <h3 className="text-xl font-bold text-white truncate">{title}</h3>
                <p className="text-sm text-purple-200/80 mb-4">by {producer}</p>
                <div className="flex items-center justify-between pt-4 border-t border-[#A429FF]/20">
                    <span className="text-2xl font-black text-[#D69CFF] font-montserrat">${price}</span>
                    <span className="text-sm text-purple-200/80">{bpm} BPM</span>
                </div>
            </div>
        </div>
    );
};


const Beats: React.FC = () => {
    const beatsData = [
        { title: 'Trap Dark 2025', producer: 'Producer_PE', price: 25, bpm: 140, seed: 'trap' },
        { title: 'Reggaeton Vibes', producer: 'Lima_Beats', price: 30, bpm: 95, seed: 'reggaeton' },
        { title: 'Drill Essence', producer: 'Peru_Drillz', price: 20, bpm: 150, seed: 'drill' },
    ];

    return (
        <section className="py-16 md:py-24" id="beats">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12">
                    <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">🎧 ESCUCHA LO QUE OTROS VENDEN</span>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight mb-4">Beats en Venta Ahora</h2>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto">De productores peruanos, para el mundo. Calidad profesional garantizada.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {beatsData.map((beat, index) => <BeatCard key={index} {...beat} />)}
                </div>
            </div>
        </section>
    );
};

export default Beats;
