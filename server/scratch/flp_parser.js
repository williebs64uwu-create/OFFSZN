/**
 * CAPYKIT - FL Studio (.flp) Parser Engine
 * Extrae rutas de samples, nombres de canales, metadatos y genera la estructura de Signature Drumkits con archivos .nfo
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class FLPParser {
    /**
     * Extrae todas las cadenas de texto (rutas de audio, nombres de canales) de un buffer de archivo .flp
     * @param {Buffer} buffer 
     * @returns {string[]} Lista de rutas de sample y nombres encontrados
     */
    static extractStringsFromFLP(buffer) {
        const strings = [];
        let curStr = '';
        
        // Expresión regular para detectar rutas de audio (.wav, .mp3, .ogg, .flac, .aif, .fst)
        const audioExtRegex = /\.(wav|mp3|ogg|flac|aif|aiff|fst)$/i;

        for (let i = 0; i < buffer.length; i++) {
            const charCode = buffer[i];
            // Rango imprimible ASCII + caracteres de ruta en Windows/Unix
            if (charCode >= 32 && charCode <= 126) {
                curStr += String.fromCharCode(charCode);
            } else {
                if (curStr.length >= 4) {
                    if (audioExtRegex.test(curStr) || curStr.includes('\\') || curStr.includes('/')) {
                        strings.push(curStr.trim());
                    }
                }
                curStr = '';
            }
        }
        if (curStr.length >= 4 && audioExtRegex.test(curStr)) {
            strings.push(curStr.trim());
        }

        // Deduplicar cadenas
        return Array.from(new Set(strings));
    }

    /**
     * Clasifica un sample por su nombre/ruta en categorías de Drumkit (808, Kick, Snare, Clap, HiHat, Loop, FX)
     * @param {string} filePath 
     * @returns {string} Categoría
     */
    static categorizeSample(filePath) {
        const name = path.basename(filePath).toLowerCase();
        
        if (name.includes('808') || name.includes('sub') || name.includes('bass') || name.includes('reese')) {
            return '808s';
        }
        if (name.includes('kick') || name.includes('bd') || name.includes('kck')) {
            return 'Kicks';
        }
        if (name.includes('snare') || name.includes('snr')) {
            return 'Snares';
        }
        if (name.includes('clap') || name.includes('clp') || name.includes('snap')) {
            return 'Claps';
        }
        if (name.includes('hihat') || name.includes('hh') || name.includes('hat') || name.includes('openhat') || name.includes('oh')) {
            return 'HiHats';
        }
        if (name.includes('loop') || name.includes('melody') || name.includes('bpm') || name.includes('sample')) {
            return 'Loops';
        }
        if (name.includes('fx') || name.includes('riser') || name.includes('impact') || name.includes('vox')) {
            return 'FX';
        }
        return 'Percs';
    }

    /**
     * Genera el contenido de un archivo .nfo para FL Studio Browser
     * @param {Object} options 
     * @returns {string} Contenido .nfo
     */
    static generateNFOContent(options = {}) {
        const color = options.color || '$0040FF'; // BGR Hex para FL Studio
        const iconNum = options.iconNum || 35; // Ícono de batería o carpeta
        const tip = options.tip || 'Sauce sounds por CapyKit';

        return `Color=${color}\nIconNum=${iconNum}\nTip=${tip}\n`;
    }

    /**
     * Escanea un proyecto .flp completo y retorna los resultados estructurados
     * @param {string} flpPath 
     * @returns {Object} Informe del proyecto
     */
    static parseProject(flpPath) {
        if (!fs.existsSync(flpPath)) {
            throw new Error(`El archivo .flp no existe en: ${flpPath}`);
        }

        const buffer = fs.readFileSync(flpPath);
        const extractedStrings = this.extractStringsFromFLP(buffer);

        // Filtrar solo las rutas que terminan en extensión de audio válida
        const audioSamples = extractedStrings.filter(s => /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(s));

        const categories = {
            '808s': [],
            'Kicks': [],
            'Snares': [],
            'Claps': [],
            'HiHats': [],
            'Loops': [],
            'FX': [],
            'Percs': []
        };

        const sampleHashes = new Set();
        let duplicatesCount = 0;

        audioSamples.forEach(samplePath => {
            const fileName = path.basename(samplePath);
            const category = this.categorizeSample(fileName);

            // Simular checksum por nombre único
            if (sampleHashes.has(fileName.toLowerCase())) {
                duplicatesCount++;
            } else {
                sampleHashes.add(fileName.toLowerCase());
                categories[category].push({
                    name: fileName,
                    fullPath: samplePath,
                    category: category
                });
            }
        });

        return {
            projectName: path.basename(flpPath),
            totalDetected: audioSamples.length,
            uniqueCount: sampleHashes.size,
            duplicatesFiltered: duplicatesCount,
            categories: categories
        };
    }
}

// Ejemplo de prueba si se ejecuta directamente
if (process.argv[1] && process.argv[1].includes('flp_parser.js')) {
    console.log('--- CAPYKIT FLP PARSER TEST ---');
    console.log('Módulo de lectura binaria para proyectos .flp cargado correctamente.');
}
