import { supabase } from '../../database/connection.js';
import { uploadBufferToR2, getPresignedDownloadUrl } from '../../services/r2-storage.service.js';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { spawn } from 'child_process';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

dotenv.config();

const FFMPEG_BIN = ffmpegPath.path;

// Groq AI Initialization (Open Source Models: Gemma, Llama)
const groqAi = process.env.GROQ_API_KEY ? new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
}) : null;

// NVIDIA NIM Initialization (Gemma 2 27B)
const nvidiaAi = process.env.NVIDIA_API_KEY ? new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1'
}) : null;
export const generateSample = async (req, res) => {
    const { prompt, userId, cost: requestedCost } = req.body;
    const modelCost = parseInt(requestedCost) || 5;

    if (!prompt || !userId) {
        return res.status(400).json({ error: 'Prompt y userId son requeridos' });
    }

    try {
        console.log(`[AI Studio] Generando Pseudo-AI para usuario ${userId}: "${prompt}"`);

        // 1. Verificar créditos (5 créditos - BETA)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('reward_balance')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            throw new Error('Usuario no encontrado');
        }

        if (user.reward_balance < modelCost) {
            return res.status(403).json({ error: `Créditos insuficientes (necesitas ${modelCost})` });
        }

        // 2. Fetch de todos los sonidos disponibles (Pseudo-IA)
        const { data: sounds, error: soundsError } = await supabase
            .from('ai_sound_bank')
            .select('*');

        if (soundsError || !sounds || sounds.length === 0) {
            throw new Error('El banco de sonidos AI está vacío temporalmente.');
        }

        // 3. Algoritmo de Matching Semántico Básico
        const promptWords = prompt.toLowerCase().split(/[\s,]+/);
        
        let bestMatch = null;
        let highestScore = -1;

        sounds.forEach(sound => {
            let score = 0;
            const nameSearch = (sound.name || "").toLowerCase();
            const catSearch = (sound.category || "").toLowerCase();
            // tags podria ser array o string dependiend de db
            const tagsSearch = Array.isArray(sound.tags) ? sound.tags.join(' ').toLowerCase() : (sound.tags || "").toLowerCase();

            promptWords.forEach(word => {
                if (word.length < 2) return; // ignore very short words
                if (nameSearch.includes(word)) score += 3;
                if (catSearch.includes(word)) score += 2;
                if (tagsSearch.includes(word)) score += 1;
            });

            // Randomizer para empates y dar sensacion de variedad organica
            score += Math.random() * 0.5; 

            if (score > highestScore) {
                highestScore = score;
                bestMatch = sound;
            }
        });

        // Fallback: Si no machea nada fuerte, elegir uno al azar
        if (highestScore < 1) {
            bestMatch = sounds[Math.floor(Math.random() * sounds.length)];
        }

        // 4. Simulamos el tiempo de "Generación" de IA (Mago de Oz - 3 segundos)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 5. Cobrar los créditos
        const newBalance = user.reward_balance - modelCost;
        
        const { error: updateError } = await supabase
            .from('users')
            .update({ reward_balance: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error('[AI Studio] Error al descontar créditos:', updateError);
        }

        console.log(`[AI Studio] Descontados ${modelCost} pts a ${userId}. Nuevo balance: ${newBalance}`);

        // 6. Generar URL firmada (V1 - Acceso Seguro)
        const signedUrl = await getPresignedDownloadUrl(bestMatch.url, 3600, 'v1');

        // 7. Guardar en el Historial de la DB
        const { error: historyError } = await supabase
            .from('studio_ai_history')
            .insert([{
                user_id: userId,
                prompt: prompt,
                audio_url: bestMatch.ruta_s3 || bestMatch.url, // 🔥 Guardar la ruta limpia, NO el signedURL que expira
                created_at: new Date().toISOString()
            }]);

        if (historyError) {
            console.error('[AI Studio] Error al guardar historial:', historyError);
        }

        console.log(`[AI Studio] Éxito. Sonido seleccionado: ${bestMatch.name}`);

        return res.status(200).json({
            success: true,
            audioUrl: signedUrl,
            remainingCredits: newBalance
        });

    } catch (error) {
        console.error('[AI Studio Error]:', error);
        return res.status(500).json({
            error: error.message || 'Error en la generación de audio'
        });
    }
};

/**
 * Chat interactivo con IA (NVIDIA NIM)
 */
export const chatWithIA = async (req, res) => {
    const { message, userId, hasReference } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message es requerido' });
    }

    try {
        // --- 1. PRE-BÚSQUEDA DE AUDIO ---
        let audioUrl = null;
        let bestMatch = null;
        const needsAudio = /crea|genera|hazme|dame|busco|quiero|808|snare|kick|loop|sample|bpm|beat/.test(message.toLowerCase());
        
        let matchInfoMessage = "No se está buscando audio específico para este mensaje.";

        if (needsAudio && userId) {
            console.log(`[AI Studio] Pre-búsqueda para: "${message}"`);
            
            // Verificar créditos
            const { data: user } = await supabase.from('users').select('reward_balance').eq('id', userId).single();
            if (!user || user.reward_balance < 5) {
                return res.status(200).json({ 
                    success: true, 
                    chatReply: "Lo siento bro, te quedaste sin créditos para generar este sonido. ¡Pásate por el store para recargar!",
                    audioUrl: null 
                });
            }

            const { data: sounds } = await supabase.from('ai_sound_bank').select('*');
            if (sounds && sounds.length > 0) {
                const promptWords = message.toLowerCase().split(/[\s,]+/);
                let highestScore = -1;
                const synonyms = {
                    'jerk': ['drill', 'club', 'bounce', 'trap'],
                    'trap': ['drill', '808', 'hard'],
                    'reggaeton': ['perreo', 'afro', 'dembow']
                };

                sounds.forEach(sound => {
                    let score = 0;
                    const name = (sound.name || "").toLowerCase();
                    const cat = (sound.category || "").toLowerCase();
                    const tags = Array.isArray(sound.tags) ? sound.tags.join(' ').toLowerCase() : (sound.tags || "").toLowerCase();
                    promptWords.forEach(word => {
                        if (word.length < 3) return;
                        if (name.includes(word)) score += 5;
                        if (cat.includes(word)) score += 3;
                        if (tags.includes(word)) score += 2;
                        for (const [key, syns] of Object.entries(synonyms)) {
                            if (word === key) {
                                syns.forEach(s => {
                                    if (name.includes(s) || cat.includes(s) || tags.includes(s)) score += 1.5;
                                });
                            }
                        }
                    });
                    score += Math.random() * 0.5;
                    if (score > highestScore) { highestScore = score; bestMatch = sound; }
                });

                if (bestMatch) {
                    audioUrl = await getPresignedDownloadUrl(bestMatch.url, 3600, 'v1');
                    const refText = hasReference ? " (Analizando la textura y ritmo de tu referencia)" : "";
                    matchInfoMessage = `He encontrado un sample llamado "${bestMatch.name}" de la categoría "${bestMatch.category}".${refText}`;
                    
                    // Cobrar créditos y Guardar Historial de Sonido
                    const newBalance = user.reward_balance - 5;
                    await supabase.from('users').update({ reward_balance: newBalance }).eq('id', userId);
                    await supabase.from('studio_ai_history').insert([{
                        user_id: userId, prompt: message, audio_url: bestMatch.url, created_at: new Date().toISOString()
                    }]);
                } else {
                    matchInfoMessage = "No encontré nada exacto, tendré que soltar un sample aleatorio de calidad.";
                }
            }
        }

        // --- 2. PERSISTIR MENSAJE DEL USUARIO ---
        if (userId) {
            await supabase.from('studio_ai_messages').insert([{ user_id: userId, role: 'user', content: message }]);
        }

        // --- 3. RESPUESTA DE LA IA (LLM) CON CONTEXTO ---
        const systemPrompt = `Eres OFFSZN AI, un asistente ultra-estricto y exclusivo de producción musical.
REGLAS DE ORO:
1. SOLO puedes hablar de producción musical: samples, géneros, etc.
2. Si piden cosas no relacionadas, RECHAZA de forma creativa con vibe de productor urbano.
3. Respuestas en español, MUY cortas y con vibe de calle/estudio.
4. CONTEXTO DE BÚSQUEDA: ${matchInfoMessage}.
5. ${hasReference ? 'MENCIONA brevemente que has analizado la referencia de audio para machear el vibe.' : ''}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `[SOLICITUD]: ${message}` }
        ];

        let replyText = null;
        if (groqAi) {
            try {
                const completion = await groqAi.chat.completions.create({
                    model: 'llama-3.1-8b-instant', messages, temperature: 0.2, max_tokens: 150
                });
                replyText = completion.choices[0]?.message?.content;
            } catch (err) { console.error('[AI Studio] Groq Falló:', err.message); }
        }

        if (!replyText) {
            replyText = bestMatch 
                ? `¡Listo bro! Te encontré este ${bestMatch.name}. ¡A cocinar!`
                : `No encontré ese vibe exacto bro, pero te solté fuego puro.`;
        }

        // --- 4. PERSISTIR RESPUESTA DE LA IA ---
        if (userId) {
            await supabase.from('studio_ai_messages').insert([{ 
                user_id: userId, role: 'ai', content: replyText, audio_url: bestMatch ? bestMatch.url : null 
            }]);
        }

        return res.status(200).json({
            success: true,
            chatReply: replyText,
            audioUrl: audioUrl,
            matchName: bestMatch?.name
        });

    } catch (error) {
        console.error('[AI Studio Chat Error]:', error);
        return res.status(500).json({ error: 'Error interno del Studio AI' });
    }
};

/**
 * Obtener el historial completo de mensajes del usuario
 */
export const getChatHistory = async (req, res) => {
    const userId = req.user.userId;

    try {
        const { data: messages, error } = await supabase
            .from('studio_ai_messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) throw error;

        // 🔥 RE-SIGN AUDIO URLS: Las URLs guardadas expiran, hay que refirmarlas
        const enrichedMessages = await Promise.all(messages.map(async (msg) => {
            if (msg.audio_url && msg.role === 'ai') {
                try {
                    // Extraer la clave (key) si es una URL completa o usarla directo si es clave
                    // El banco de sonidos suele estar en v1
                    let key = msg.audio_url;
                    if (key.includes('.com/')) {
                        key = key.split('.com/')[1].split('?')[0];
                        // 🔥 Limpiar el bucket si viene en el path
                        if (key.startsWith('offszn-storage/')) key = key.replace('offszn-storage/', '');
                        if (key.startsWith('offsznlatbucket/')) key = key.replace('offsznlatbucket/', '');
                    }
                    
                    const newUrl = await getPresignedDownloadUrl(key, 3600, 'v1');
                    return { ...msg, audio_url: newUrl || msg.audio_url };
                } catch (e) {
                    console.error('[History Re-sign Error]:', e.message);
                }
            }
            return msg;
        }));

        return res.status(200).json({ success: true, messages: enrichedMessages });
    } catch (error) {
        console.error('[AI Studio History Error]:', error);
        return res.status(500).json({ error: 'Error al recuperar el historial' });
    }
};

/**
 * Obtener el historial de la pestaña "Historial"
 */
export const getStudioHistory = async (req, res) => {
    const userId = req.user.userId;

    try {
        const { data: history, error } = await supabase
            .from('studio_ai_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // 🔥 RE-SIGN AUDIO URLS: Las URLs guardadas expiran
        const enrichedMessages = await Promise.all(history.map(async (msg) => {
            if (msg.audio_url) {
                try {
                    let key = msg.audio_url;
                    if (key.includes('.com/')) {
                        key = key.split('.com/')[1].split('?')[0];
                        if (key.startsWith('offszn-storage/')) key = key.replace('offszn-storage/', '');
                        if (key.startsWith('offsznlatbucket/')) key = key.replace('offsznlatbucket/', '');
                    }
                    
                    const newUrl = await getPresignedDownloadUrl(key, 3600, 'v1');
                    return { ...msg, audio_url: newUrl || msg.audio_url };
                } catch (e) {
                    console.error('[History Tab Re-sign Error]:', e.message);
                }
            }
            return msg;
        }));

        return res.status(200).json({ success: true, history: enrichedMessages });
    } catch (error) {
        console.error('[AI Studio History Tab Error]:', error);
        return res.status(500).json({ error: 'Error al recuperar historial' });
    }
};

/**
 * Descargar audio con metadatos personalizados inyectados al vuelo (FFMPEG)
 */
export const downloadWithMetadata = async (req, res) => {
    const { url, title } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL del audio es requerida' });
    }

    try {
        console.log(`[Metadata Proxy] Procesando descarga: ${title || 'Sin título'} desde ${url}`);

        // 1. Obtener el archivo original
        const audioResponse = await fetch(url);
        if (!audioResponse.ok) throw new Error(`Fallo al obtener el audio: ${audioResponse.statusText}`);

        // 2. Preparar metadatos (Sanitización básica para FFmpeg)
        const cleanTitle = (title || 'Studio AI Sample').substring(0, 100).replace(/[\\"]/g, '');
        const artist = 'OFFSZN';
        const album = 'OFFSZN Studio AI';
        const year = new Date().getFullYear().toString();
        const genre = 'Studio AI';

        // Determinar formato (si es wav o mp3)
        const isWav = url.toLowerCase().includes('.wav');
        const format = isWav ? 'wav' : 'mp3';

        // 3. Configurar Headers para la descarga
        const filename = `${cleanTitle.replace(/\s+/g, '_')}.${format}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', isWav ? 'audio/wav' : 'audio/mpeg');

        // 4. Inyectar metadatos vía FFMPEG (Streaming)
        const ffmpegProcess = spawn(FFMPEG_BIN, [
            '-i', 'pipe:0',
            '-metadata', `title=${cleanTitle}`,
            '-metadata', `artist=${artist}`,
            '-metadata', `album=${album}`,
            '-metadata', `date=${year}`,
            '-metadata', `genre=${genre}`,
            '-metadata', `comment=Generado en OFFSZN.lat`,
            '-f', format,
            'pipe:1'
        ]);

        ffmpegProcess.on('error', (err) => {
            console.error('[FFMPEG Error]:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Error procesando audio' });
        });

        // 5. Pipe: Stream Input -> FFmpeg -> Response
        const bodyStream = audioResponse.body;
        const { Readable } = await import('stream');
        const readable = Readable.from(bodyStream);
        
        readable.pipe(ffmpegProcess.stdin);
        ffmpegProcess.stdout.pipe(res);

    } catch (error) {
        console.error('[Metadata Proxy Error]:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Error al procesar la descarga con metadatos' });
        }
    }
};

/**
 * YouTube Smart Match using NVIDIA NIM (Gemma 2)
 * Compares a video title with a list of products semantically
 */
export const youtubeSmartMatch = async (req, res) => {
    const { videoTitle, products } = req.body;

    if (!videoTitle || !products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'videoTitle y products (array) son requeridos' });
    }

    if (!nvidiaAi) {
        return res.status(503).json({ error: 'Servicio de IA de NVIDIA no configurado' });
    }

    try {
        const productList = products.map((p, i) => `ID:${i} | Name: "${p.name}"`).join('\n');
        
        const systemPrompt = `Eres un experto en organización de catálogos musicales y marketing en YouTube. 
Tu tarea es encontrar qué producto de una lista coincide MEJOR con el título de un video de YouTube.
REGLAS CRÍTICAS:
1. Responde ÚNICAMENTE con el ID del producto que mejor coincida.
2. Si no hay una coincidencia clara (semántica o textual), responde "NONE".
3. EXCLUSIÓN DE NO-BEATS: Si el video parece ser un Vlog, Tutorial, Detrás de cámaras, o un Short de contenido no musical (charlando, etc.), responde "NONE".
4. Limpieza de Títulos: Ignora "Official Video", "prod by", "Beat", "Instrumental", "Type Beat", etc.
5. Multilenguaje: Detecta si el título está en inglés (ej. "Summer Vibes") y emparéjalo con el beat equivalente (ej. "Summer Breeze").
6. Rigurosidad: Es mejor no vincular (responder "NONE") que vincular un video de contenido aleatorio a un beat.`;

        const userPrompt = `TÍTULO DEL VIDEO: "${videoTitle}"\n\nLISTA DE PRODUCTOS:\n${productList}\n\nID del mejor match:`;

        let reply = "";
        try {
            const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.NVIDIA_NIM_API_KEY}`
                },
                body: JSON.stringify({
                    model: "google/gemma-3n-e4b-it",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 10
                })
            });

            if (!response.ok) {
                console.warn(`NVIDIA API error: ${response.status}`);
                return res.status(200).json({ success: true, matchIndex: -1 });
            }

            const data = await response.json();
            reply = data.choices[0].message.content.trim();
        } catch (error) {
            console.error("NIM Fetch Error:", error);
            return res.status(200).json({ success: true, matchIndex: -1 });
        }

        if (reply.includes("NONE") || reply === "") {
            return res.status(200).json({ success: true, matchIndex: -1 });
        }

        const matchId = parseInt(reply.replace(/[^0-9]/g, ''));
        if (isNaN(matchId) || matchId < 0 || matchId >= products.length) {
            return res.status(200).json({ success: true, matchIndex: -1 });
        }

        return res.status(200).json({ success: true, matchIndex: matchId });

    } catch (error) {
        console.error('[YouTube Smart Match Error]:', error);
        return res.status(500).json({ error: 'Error en el matching inteligente' });
    }
};
