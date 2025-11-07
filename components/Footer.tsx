
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-black/50 border-t border-white/10 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    <div className="col-span-2 md:col-span-2">
                        <h3 className="text-2xl font-black text-white tracking-wider font-montserrat mb-4">OFFSZN</h3>
                        <p className="text-gray-400 text-sm mb-6 max-w-xs">El primer marketplace musical hecho en Perú 🇵🇪</p>
                        <div className="flex gap-3">
                            <a href="#" className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-purple-300 hover:bg-white/10 hover:text-white transition"><i className="bi bi-instagram"></i></a>
                            <a href="#" className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-purple-300 hover:bg-white/10 hover:text-white transition"><i className="bi bi-discord"></i></a>
                            <a href="#" className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 rounded-full text-purple-300 hover:bg-white/10 hover:text-white transition"><i className="bi bi-youtube"></i></a>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Recursos</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Beats</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Drum Kits</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Presets</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Recursos Gratis</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Comunidad</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Productores</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Colaboraciones</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Foros</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Discord</a></li>
                        </ul>
                    </div>
                     <div>
                        <h4 className="font-bold text-white mb-4">Legal</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Términos de Uso</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Privacidad</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white text-sm transition">Contacto</a></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-6 text-center text-gray-500 text-sm">
                    <p>© 2025 OFFSZN. Hecho con 💜 en Perú.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
