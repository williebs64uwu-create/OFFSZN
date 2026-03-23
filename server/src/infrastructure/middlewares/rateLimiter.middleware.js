import rateLimit from 'express-rate-limit';

// Global API Limiter
// Aplica a todas las rutas genéricas para evitar abusos o DDoS básico (Scraping).
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 500, // Límite de 500 peticiones por IP cada 15 min
    standardHeaders: 'draft-7', // Retorna headers de RateLimit
    legacyHeaders: false, // Deshabilita headers X-RateLimit
    message: {
        error: "Demasiadas peticiones desde esta IP. Por favor, intenta de nuevo más tarde."
    },
    skip: (req) => {
        const ua = req.get('User-Agent') || '';
        return /Discordbot|Twitterbot|facebookexternalhit|LinkedInBot|slackbot|Googlebot|TelegramBot|WhatsApp/i.test(ua);
    }
});

// Strict Auth Limiter
// Aplica específicamente a /login, /register, /check-email para evitar Brute Force o Enumeration attacks.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 15, // Límite más estricto (15 intentos cada 15 min)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        error: "Demasiados intentos de autenticación. Por seguridad, bloqueado temporalmente. Intenta nuevamente en 15 minutos."
    }
});
