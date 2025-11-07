
import React, { useState, useRef } from 'react';

type SaleState = 'idle' | 'prompt' | 'success';

const InteractiveDemo: React.FC = () => {
    const [saleState, setSaleState] = useState<SaleState>('idle');
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startSimulation = () => {
        setSaleState('prompt');
    };
    
    const acceptSale = () => {
        setSaleState('success');
    };

    const rejectSale = () => {
        alert("La venta ha sido rechazada.");
        setSaleState('idle');
        setFileName(null);
    };

    const handleFileSelect = (files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            const isAudio = file.type.startsWith('audio/mpeg') || file.type.startsWith('audio/wav') || file.name.endsWith('.mp3') || file.name.endsWith('.wav');
            if (isAudio) {
                setFileName(file.name);
                startSimulation();
            } else {
                alert('Por favor, sube un archivo MP3 o WAV.');
            }
        }
    };
    
    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isOver: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (saleState === 'idle') {
            setIsDragging(isOver);
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (saleState === 'idle') {
            setIsDragging(false);
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const handleClick = () => {
        if (saleState === 'idle') {
            fileInputRef.current?.click();
        }
    };

    return (
    <section className="demo-section" id="demo">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="block text-sm font-bold tracking-[2px] uppercase text-[#D69CFF] mb-3">✨ AHORA TE TOCA A TI</span>
            <h2 className="text-4xl md:text-5xl font-black text-white font-montserrat leading-tight mb-4">Simula Tu Primera Venta</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              En 3 simples pasos, convierte tu música en ingresos.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#A429FF] to-[#7A1FBF] rounded-full flex items-center justify-center text-xl font-black text-white mx-auto mb-4 shadow-lg shadow-[#A429FF]/40">1</div>
              <h3 className="text-xl font-bold text-white mb-2">Sube tu archivo</h3>
              <p className="text-sm text-purple-200/80">Beat, Kit o Preset. Formatos WAV, MP3, ZIP aceptados.</p>
            </div>
            <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#A429FF] to-[#7A1FBF] rounded-full flex items-center justify-center text-xl font-black text-white mx-auto mb-4 shadow-lg shadow-[#A429FF]/40">2</div>
              <h3 className="text-xl font-bold text-white mb-2">Define tu precio</h3>
              <p className="text-sm text-purple-200/80">Tú decides cuánto vale tu trabajo.</p>
            </div>
             <div className="bg-[#1a0a2e]/40 border border-[#A429FF]/20 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-[#A429FF] to-[#7A1FBF] rounded-full flex items-center justify-center text-xl font-black text-white mx-auto mb-4 shadow-lg shadow-[#A429FF]/40">3</div>
              <h3 className="text-xl font-bold text-white mb-2">¡Publica y cobra!</h3>
              <p className="text-sm text-purple-200/80">Recibe pagos en Yape o PayPal. Instantáneo.</p>
            </div>
          </div>
          <div 
            className={`mt-8 p-10 bg-[#A429FF]/5 border-2 border-dashed rounded-2xl text-center transition-all duration-300 ${isDragging ? 'bg-[#A429FF]/20 border-[#A429FF]/80' : 'border-[#A429FF]/30'} ${saleState !== 'idle' ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#A429FF]/10 hover:border-[#A429FF]/50 cursor-pointer'}`}
            onClick={handleClick}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDrop={handleDrop}
            >
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
                accept=".mp3,.wav,audio/mpeg,audio/wav"
                className="hidden"
                disabled={saleState !== 'idle'}
            />
            <div className="text-4xl text-[#D69CFF] mb-3">
                {fileName && saleState !== 'idle' ? <i className="bi bi-file-earmark-music"></i> : <i className="bi bi-cloud-upload"></i>}
            </div>
            <div className="text-lg font-bold text-white mb-1">
                {fileName && saleState !== 'idle' ? `¡${fileName} listo!` : 'Arrastra tu archivo aquí'}
            </div>
            <div className="text-sm text-purple-200/80">
                {fileName && saleState !== 'idle' ? 'Hemos detectado un posible comprador.' : 'o haz clic para seleccionar (MP3 o WAV)'}
            </div>
          </div>
          
          {saleState === 'prompt' && (
            <div className="mt-8 p-6 bg-[#1a0a2e]/60 rounded-2xl text-center animate-fade-in">
              <h3 className="text-lg text-white font-bold mb-2">🎉 ¡Una venta está por cerrarse!</h3>
              <p className="text-purple-200/90 mb-4">
                <strong>Willie Inspired</strong> quiere comprar tu producto <strong>"{fileName}"</strong> por <strong>$25</strong>.
              </p>
              <div className="flex gap-4 justify-center">
                <button onClick={acceptSale} className="px-6 py-2 rounded-lg text-white font-bold bg-gradient-to-r from-green-500 to-emerald-600 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/40 flex items-center gap-2">
                  <i className="bi bi-check2"></i> Aceptar
                </button>
                <button onClick={rejectSale} className="px-6 py-2 rounded-lg text-white font-bold bg-transparent border-2 border-white/20 transition hover:bg-white/5 hover:border-white/40 flex items-center gap-2">
                  <i className="bi bi-x-lg"></i> Rechazar
                </button>
              </div>
            </div>
          )}

          {saleState === 'success' && (
            <div className="mt-8 p-6 bg-green-500/10 border-2 border-green-500/30 rounded-2xl text-center animate-fade-in">
                <div className="text-4xl text-green-400 mb-2">✅</div>
                <h3 className="text-lg text-white font-bold mb-1">¡Venta Exitosa!</h3>
                <p className="text-purple-200/90">$25 han sido transferidos a tu cuenta.</p>
            </div>
          )}
        </div>
      </section>
    );
};

export default InteractiveDemo;
