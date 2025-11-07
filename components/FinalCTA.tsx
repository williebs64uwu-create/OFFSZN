
import React from 'react';

const FinalCTA: React.FC = () => {
    return (
        <section className="py-20 md:py-32" id="register">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white font-montserrat leading-tight mb-6">
                    ¿Listo para vender tu música?
                </h2>
                <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
                    Únete a +100 productores peruanos que ya están generando ingresos con su música.
                </p>
                <a href="#register" className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-white text-lg font-bold bg-gradient-to-r from-[#A429FF] to-[#7A1FBF] transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#A429FF]/40">
                    Crear Cuenta Gratis <i className="bi bi-arrow-right"></i>
                </a>
            </div>
        </section>
    );
};

export default FinalCTA;
