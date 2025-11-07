
import React, { useState } from 'react';

const faqData = [
    {
        question: '¿Cómo empiezo a vender en OFFSZN?',
        answer: 'Crea tu cuenta gratis, configura tus métodos de pago (Yape o PayPal) y sube tus productos. En minutos estarás vendiendo.'
    },
    {
        question: '¿Qué comisión cobra OFFSZN?',
        answer: 'Solo cobramos 5% por transacción completada. Sin costos ocultos, sin mensualidades.'
    },
    {
        question: '¿Puedo vender beats, kits y presets?',
        answer: '¡Sí! Puedes vender cualquier tipo de contenido musical: beats, drum kits, presets de vocal, samples, loops y más.'
    },
    {
        question: '¿Cómo recibo mis pagos?',
        answer: 'Puedes configurar Yape (para pagos en soles) o PayPal (para pagos internacionales). Los pagos son instantáneos.'
    },
    {
        question: '¿Necesito ser productor profesional?',
        answer: 'No. OFFSZN es para todos los niveles. Desde principiantes hasta profesionales. Lo importante es la calidad de tu trabajo.'
    }
];

const FAQItem = ({ faq, index, activeIndex, setActiveIndex }: { faq: { question: string, answer: string }, index: number, activeIndex: number | null, setActiveIndex: (index: number | null) => void }) => {
    const isActive = index === activeIndex;

    const toggleFaq = () => {
        setActiveIndex(isActive ? null : index);
    };

    return (
        <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-xl overflow-hidden transition-all duration-300">
            <div className="flex justify-between items-center p-5 cursor-pointer" onClick={toggleFaq}>
                <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                <i className={`bi bi-chevron-down text-xl text-[#D69CFF] transition-transform duration-300 ${isActive ? 'transform rotate-180' : ''}`}></i>
            </div>
            <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isActive ? 'max-h-40' : 'max-h-0'}`}>
                <p className="text-purple-200/80 p-5 pt-0">{faq.answer}</p>
            </div>
        </div>
    );
};

const FAQ: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState<number | null>(0);

    return (
        <section className="py-16 md:py-24 bg-black/20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-12">
                    <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">❓ PREGUNTAS FRECUENTES</span>
                    <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight">Todo lo que necesitas saber</h2>
                </div>
                <div className="flex flex-col gap-4">
                    {faqData.map((faq, index) => (
                        <FAQItem key={index} faq={faq} index={index} activeIndex={activeIndex} setActiveIndex={setActiveIndex} />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FAQ;
