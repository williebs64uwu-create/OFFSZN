
import React, { useState, useEffect, useRef } from 'react';

type DropdownMenu = 'recursos' | 'comunidad' | null;

const SparkleButton = () => (
    <a href="#marketplace" className="relative inline-flex items-center justify-center text-center no-underline text-white text-sm font-bold h-9 w-auto px-6 rounded-xl bg-[#A429FF] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#A429FF]/50">
      Marketplace
      <span className="sparkle-wrap" aria-hidden="true">
        <span className="particle" style={{ '--a': '-45deg', '--x': '53%', '--y': '15%', '--d': '4em', '--f': '.7', '--t': '.15' } as React.CSSProperties}></span>
        <span className="particle" style={{ '--a': '150deg', '--x': '40%', '--y': '70%', '--d': '7.5em', '--f': '.8', '--t': '.08' } as React.CSSProperties}></span>
        <span className="particle" style={{ '--a': '10deg', '--x': '90%', '--y': '65%', '--d': '7em', '--f': '.6', '--t': '.25' } as React.CSSProperties}></span>
        <span className="particle" style={{ '--a': '-120deg', '--x': '15%', '--y': '10%', '--d': '4em' } as React.CSSProperties}></span>
        <span className="particle" style={{ '--a': '-175deg', '--x': '10%', '--y': '25%', '--d': '5.25em', '--f': '.6', '--t': '.32' } as React.CSSProperties}></span>
      </span>
    </a>
);

// FIX: Define an interface for dropdown items to make `desc` optional and resolve type errors.
interface DropdownItem {
    icon: string;
    title: string;
    desc?: string;
}

const Dropdown = ({ menu }: { menu: 'recursos' | 'comunidad' }) => {
    const recursosItems: DropdownItem[] = [
        { icon: 'bi-sliders', title: 'Presets & Plugins', desc: 'Chains profesionales' },
        { icon: 'bi-music-note-beamed', title: 'Beats & Instrumentales', desc: 'Licencias disponibles' },
        { icon: 'bi-disc', title: 'Drum Kits', desc: 'Samples únicos' },
        { icon: 'bi-soundwave', title: 'Samples & Loops', desc: 'Loops de calidad' },
    ];
    const comunidadItems: DropdownItem[] = [
        { icon: 'bi-house', title: 'Feed' },
        { icon: 'bi-people', title: 'Productores' },
        { icon: 'bi-hand-index-thumb', title: 'Colaboraciones' },
        { icon: 'bi-chat-dots', title: 'Foros' },
    ];

    const items = menu === 'recursos' ? recursosItems : comunidadItems;

    return (
        <div className="absolute top-full mt-3 w-64 bg-[#11051e] border border-white/10 rounded-xl shadow-2xl p-2 animate-fade-in">
            {items.map(item => (
                <a key={item.title} href="#" className="flex items-center gap-3 p-2.5 rounded-lg text-white/80 hover:bg-white/5 hover:text-white transition-colors">
                    <i className={`bi ${item.icon} text-lg text-purple-400`}></i>
                    <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        {item.desc && <div className="text-xs text-white/50">{item.desc}</div>}
                    </div>
                </a>
            ))}
        </div>
    );
};

const Header: React.FC = () => {
    const [openDropdown, setOpenDropdown] = useState<DropdownMenu>(null);
    const navRef = useRef<HTMLElement>(null);

    const toggleDropdown = (menu: DropdownMenu) => {
        setOpenDropdown(prev => (prev === menu ? null : menu));
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className="sticky top-0 bg-black/95 backdrop-blur-2xl border-b border-white/10 p-3 z-[1000]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-8">
                <a href="#inicio" className="text-2xl font-black text-white tracking-wider font-montserrat">OFFSZN</a>
                <nav ref={navRef} className="hidden lg:flex items-center gap-8 flex-1">
                    <ul className="flex items-center gap-2">
                        <li><a href="#inicio" className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-white/10 text-white">Inicio</a></li>
                        <li className="relative">
                            <button onClick={() => toggleDropdown('recursos')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors">
                                Recursos <i className={`bi bi-chevron-down text-xs transition-transform ${openDropdown === 'recursos' ? 'rotate-180' : ''}`}></i>
                            </button>
                            {openDropdown === 'recursos' && <Dropdown menu="recursos" />}
                        </li>
                        <li className="relative">
                             <button onClick={() => toggleDropdown('comunidad')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors">
                                Comunidad <i className={`bi bi-chevron-down text-xs transition-transform ${openDropdown === 'comunidad' ? 'rotate-180' : ''}`}></i>
                            </button>
                            {openDropdown === 'comunidad' && <Dropdown menu="comunidad" />}
                        </li>
                        <li><SparkleButton /></li>
                        <li><a href="#cursos" className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-white/70 hover:text-white">Cursos <span className="text-xs bg-[#A429FF] text-white font-bold px-2 py-1 rounded-md">SOON</span></a></li>
                    </ul>
                </nav>
                <div className="flex items-center gap-2">
                    <a href="#login" className="hidden sm:block text-white/75 hover:text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors">Iniciar Sesión</a>
                    <a href="#register" className="hidden sm:flex items-center gap-2 bg-[#A429FF] text-white px-5 py-2 rounded-xl text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#A429FF]/50">Únete <i className="bi bi-rocket-takeoff"></i></a>
                    <a href="#cart" className="border border-white/20 text-white/75 hover:text-white hover:bg-white/5 w-10 h-10 flex items-center justify-center rounded-xl transition-colors text-lg"><i className="bi bi-cart3"></i></a>
                    <button className="lg:hidden border border-white/20 text-white/75 hover:text-white hover:bg-white/5 w-10 h-10 flex items-center justify-center rounded-lg transition-colors text-lg">
                        <i className="bi bi-list"></i>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
