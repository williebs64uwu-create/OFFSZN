import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

const systemPrompt = `
Eres un asistente de servicio al cliente experto para OFFSZN. 
Tu nombre es "OFFSZN Bot".

SOBRE OFFSZN:
OFFSZN es una plataforma y comunidad para productores de música urbana. 
Vendemos productos como:
- Vocal Presets (Presets Vocales)
- Cursos de producción musical
- Kits de batería (Drum Kits) y Loops
- Plugins y herramientas para FL Studio y otros DAWs.

TUS REGLAS ESTRICTAS:
1.  **SÓLO CONTEXTO:** Tu única tarea es responder preguntas sobre OFFSZN, nuestros productos, producción musical relacionada con nuestros cursos, o ayudar al usuario a navegar el sitio.
2.  **PREGUNTAS FUERA DE TEMA:** Si el usuario pregunta sobre cualquier otra cosa (clima, historia, matemáticas, chistes, etc.), DEBES responder EXACTAMENTE con: "Disculpa, no entendí tu pregunta ya que no está relacionada con OFFSZN". No digas nada más.
3.  **CONTACTAR ASESOR:** Si el usuario pide "contactar un asesor", "hablar con un humano", "soporte" o algo similar, DEBES responder con un mensaje amigable y el siguiente enlace de WhatsApp:
    "¡Claro! Para hablar con un asesor de nuestro equipo, por favor escríbenos a este chat de WhatsApp: https://wa.link/ksml7o"
4.  **TONO:** Eres amigable, profesional y directo. Usas emojis de forma sutil. 🎵🎧

Ahora, comienza la conversación con el usuario.
`;

router.post('/chat', async (req, res) => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); 
        const { prompt } = req.body;

        const chat = model.startChat({
             history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "¡Hola! Soy OFFSZN Bot. ¿En qué puedo ayudarte hoy? 🎵" }] }
             ]
        });
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ text: text });
    } catch (error) {
        console.error("Error llamando a la API de Gemini:", error);
        res.status(500).json({ error: "Error del servidor" });
    }
});

export default router;