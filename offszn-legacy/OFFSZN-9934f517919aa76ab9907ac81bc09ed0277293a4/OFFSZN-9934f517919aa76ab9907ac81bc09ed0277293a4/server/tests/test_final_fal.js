import { createClient } from '@supabase/supabase-js';
import * as fal from "@fal-ai/serverless-client";
import dotenv from 'dotenv';

dotenv.config();

// Configurar Fal.ai
process.env.FAL_KEY = "e7548196-8fc7-45bb-bc43-5da8756b93a1:67c18b1538581108090393a27b1c3b3c";

async function testFinalFal() {
    console.log("Probando generación final con Fal.ai...");
    try {
        const result = await fal.subscribe("fal-ai/stable-audio", {
            input: {
                prompt: "hard trap kick drum short and punchy",
                seconds_total: 5
            },
            logs: true
        });
        console.log("Éxito en Fal.ai!");
        console.log("URL:", result.audio_file.url);
    } catch (e) {
        console.log("Error en prueba final:", e.message);
    }
}

testFinalFal();
