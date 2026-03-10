import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import helmet from 'helmet';
import { PORT } from '../src/shared/config/config.js'
import { checkConnection } from './infrastructure/database/connection.js'

// Importación de rutas
import authRoutes from './infrastructure/http/routes/auth.routes.js';
import publicRoutes from './infrastructure/http/routes/public.routes.js';
import productRoutes from './infrastructure/http/routes/product.routes.js';
import cartRoutes from './infrastructure/http/routes/cart.routes.js';
import orderRoutes from './infrastructure/http/routes/order.routes.js';
import userRoutes from './infrastructure/http/routes/user.routes.js';
import adminRoutes from './infrastructure/http/routes/admin.routes.js';
// import chatbotRouter from './routes/chatbot.js';
import profileRoutes from './infrastructure/http/routes/profile.routes.js';
import reelsRoutes from './infrastructure/http/routes/reels.routes.js';
import { handleMercadoPagoWebhook } from './infrastructure/http/controllers/OrderController.js';
import chatRoutes from './infrastructure/http/routes/chat.routes.js';
import paypalRoutes from './infrastructure/http/routes/paypal.routes.js';
import r2Routes from './infrastructure/http/routes/r2.routes.js';
import subscriptionRoutes from './infrastructure/http/routes/subscription.routes.js';
import requestRoutes from './infrastructure/http/routes/request.routes.js';
import youtubeRoutes from './infrastructure/http/routes/youtube.routes.js';

import cloudinaryRoutes from './infrastructure/http/routes/cloudinary.routes.js';
import { submitNegotiation, respondNegotiation, generatePurchaseToken, validatePurchaseToken, reportIssue } from './infrastructure/http/controllers/NegotiationController.js';
import { authenticateTokenMiddleware } from './infrastructure/middlewares/authenticateTokenMiddleware.js';
import { globalLimiter } from './infrastructure/middlewares/rateLimiter.middleware.js';





const app = express();
app.disable('x-powered-by'); // Deshabilita el header que delata el uso de Express
app.set('trust proxy', 1); // Confiar en el proxy de Render para express-rate-limit

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.join(__dirname, '../../');

// --- 0. SECURITY HEADERS (MANDATORY FOR FFMPEG WASM) ---
// We apply this only to pages that need FFmpeg and their cleaning scripts
// to avoid breaking external resources (like avatars/images) on the rest of the site.
app.use((req, res, next) => {
    const ffmpegPaths = [
        '/legal/offszn-debug',
        // '/cuenta/Upload/Beats', // 🔥 REMOVED: This strict COOP header blocks Google Auth Popup callbacks. The new Clean Pipeline doesn't need it.
        '/ffmpeg_clean',
        '/offszn-debug'
    ];

    if (ffmpegPaths.some(p => req.path.startsWith(p))) {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    }

    next();
});

// --- 1. CONFIGURACIÓN CORS ROBUSTA ---
const allowedOrigins = [
    'https://offszn.lat',
    'http://localhost:3000'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("⚠️ CORS Warning (dev):", origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200
};

// --- 2. MIDDLEWARES GLOBALES ---
// A. Security Headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:",
                "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com",
                "https://cdn.tailwindcss.com", "https://apis.google.com", "https://accounts.google.com",
                "https://*.gstatic.com",
                // PayPal
                "https://www.paypal.com", "https://www.sandbox.paypal.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "data:", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "blob:",
                "https://images.unsplash.com", "https://*.supabase.co",
                "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com",
                "https://res.cloudinary.com", "https://via.placeholder.com",
                "https://*.ytimg.com", "https://*.ggpht.com", "https://*.googleusercontent.com",
                "https://ui-avatars.com",
                // PayPal
                "https://www.paypalobjects.com", "https://*.paypal.com"
            ],
            mediaSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com"],
            connectSrc: ["'self'", "blob:",
                "https://*.supabase.co", "wss://*.supabase.co",
                "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com", "https://*.r2.dev",
                "https://api.emailjs.com",
                // PayPal
                "https://api.paypal.com", "https://www.paypal.com", "https://www.sandbox.paypal.com",
                "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com",
                "https://cdn.jsdelivr.net", "https://unpkg.com", "https://offszn.lat",
                "http://localhost:*",
                "https://*.googleapis.com", "https://accounts.google.com",
                "https://*.ytimg.com", "https://*.ggpht.com"
            ],
            frameSrc: ["'self'",
                "https://www.youtube.com", "https://www.youtube-nocookie.com",
                "https://open.spotify.com",
                // PayPal
                "https://www.paypal.com", "https://www.sandbox.paypal.com",
                "https://accounts.google.com", "https://*.googleapis.com"
            ],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // 🔥 REQUIRED: Without this, Google OAuth popup can't send token back to opener
    hsts: {
        maxAge: 31536000, // 1 año en segundos
        includeSubDomains: true,
        preload: true
    }
}));

// Aplicar CORS a todo
app.use(cors(corsOptions));

// DEBUG LOGGER
app.use((req, res, next) => {
    console.log(`📡 Request: ${req.method} ${req.originalUrl}`);
    next();
});

// --- 2.1 PARSEO DE JSON & COOKIES ---
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, EMAILJS_PUBLIC_KEY } from '../src/shared/config/config.js'

// --- PUBLIC ENVIRONMENT VARIABLES ---
app.get('/env.js', (req, res) => {
    res.type('.js');
    res.send(`
        window.SUPABASE_URL = "${SUPABASE_URL || 'https://qtjpvztpgfymjhhpoouq.supabase.co'}";
        window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw'}";
        window.EMAILJS_PUBLIC_KEY = "${EMAILJS_PUBLIC_KEY || 'If_WAVcuXiGSPp2SB'}";
        window.PAYPAL_CLIENT_ID = "${process.env.PAYPAL_CLIENT_ID || ''}";
    `);
});

// --- 2.2 CLOUDINARY ROUTES (before global JSON parser — needs 30MB limit) ---
app.use('/api/cloudinary', express.json({ limit: '30mb' }), cloudinaryRoutes);

app.use(express.json());
app.use(cookieParser());

// --- 2.3 GLOBAL RATE LIMITING ---
// Protege toda la aplicación contra ataques de fuerza bruta básicos o Ddos
app.use('/api', globalLimiter);

// --- RESTO DE RUTAS API (Omitidas para evitar borrado accidental) ---
// (Líneas 139-173 del archivo original que fueron movidas o borradas se restauran a continuación)
app.use('/api/reels', reelsRoutes);
app.post('/api/orders/mercadopago-webhook', handleMercadoPagoWebhook);
app.post('/api/negotiate', submitNegotiation);
app.post('/api/negotiate/respond', respondNegotiation);
app.post('/api/negotiate/purchase-token', authenticateTokenMiddleware, generatePurchaseToken);
app.get('/api/negotiate/validate-token', validatePurchaseToken);
app.post('/api/negotiate/report', authenticateTokenMiddleware, reportIssue);

app.get('/api/health', (req, res) => {
    const secret = req.headers['x-offszn-secret'];
    const expectedSecret = 'offszn_keep_alive_2026_safe';
    if (secret !== expectedSecret) return res.status(403).json({ error: 'Unauthorized' });
    res.status(200).send('OK');
});

app.use('/api', publicRoutes);
app.use('/api', requestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', profileRoutes);
app.use('/api', chatRoutes);
app.use('/api', paypalRoutes);
app.use('/api', r2Routes);
app.use('/api', subscriptionRoutes);
app.use('/api', youtubeRoutes);

// --- 3. CLEAN URLS & STATIC FILES (MIDDLEWARE) ---

// A. Security Block (Prevent access to backend source & secrets)
app.use((req, res, next) => {
    const sensitiveStart = ['/server', '/.env', '/.git', '/render.yaml', '/node_modules', '/backend'];
    if (sensitiveStart.some(s => req.path.startsWith(s))) {
        return res.status(403).send('Forbidden');
    }
    next();
});

// B. Clean URLs (Force Redirects & Internal Rewrites)
app.use((req, res, next) => {
    // Skip API routes and FFmpeg/Debug folders to avoid loops or blocking
    const skipPaths = ['/api', '/ffmpeg_clean', '/offszn-debug', '/legal/offszn-debug', '/env.js'];
    if (skipPaths.some(p => req.path.startsWith(p))) return next();

    // 1. Force Redirect: Remove .html from browser address bar
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.replace(/\.html$/, '');
        const search = req.originalUrl.split('?')[1];
        const queryString = search ? '?' + search : '';

        if (cleanPath.endsWith('/index')) {
            const rootPathRedirect = cleanPath.slice(0, -6) || '/';
            return res.redirect(301, rootPathRedirect + queryString);
        }
        return res.redirect(301, cleanPath + queryString);
    }

    // 2. Extra cleaning: if user typed /something/ (trailing slash), remove it unless it's the root
    if (req.path.length > 1 && req.path.endsWith('/')) {
        return res.redirect(301, req.path.slice(0, -1));
    }

    // 3. Internal Rewriting: If no extension, try to serve the .html file
    if (!path.extname(req.path)) {
        const possibleHtml = path.join(rootPath, req.path + '.html');
        if (fs.existsSync(possibleHtml)) {
            return res.sendFile(possibleHtml);
        }
    }

    next();
});

// C1. Serve Static Files from Server Public (Prioritize this for moved assets)
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// C. Serve Static Files from Root
app.use(express.static(rootPath));

// --- 3.4 PRODUCT SHORTCUT ROUTES (SEO Friendly) ---
// Serve producto.html for /beat/slug, /kit/slug, etc.
app.get([
    '/beat/:slug',
    '/kit/:slug',
    '/drumkit/:slug',
    '/loopkit/:slug',
    '/preset/:slug',
    '/plantilla/:slug',
    '/sample/:slug',
    '/instrumento/:slug',
    '/plugin/:slug',
    '/voces/:slug',
    '/p/:code' // 🔥 Short Link Route
], (req, res, next) => {
    const { slug, code } = req.params;
    // Serve Producto
    const productPage = path.join(rootPath, 'producto.html');
    if (fs.existsSync(productPage)) {
        res.sendFile(productPage);
    } else {
        next();
    }
});

// --- 3.5 BIOLINK SHORTCUT ROUTE (/b/:username) ---
// Supports both /b/@username and /b/username
app.get([
    '/b/@:username',
    '/b/:username'
], async (req, res, next) => {
    const { username } = req.params;

    // Serve Bio Template with OG Tags injected
    const bioPagePath = path.join(rootPath, 'bio-demo.html');
    if (!fs.existsSync(bioPagePath)) return next();

    try {
        // Fetch user basic data for OG Tags
        const { supabase } = await import('./infrastructure/database/connection.js');
        const { data: user } = await supabase
            .from('users')
            .select('nickname, role, avatar_url, bio')
            .eq('nickname', username)
            .single();

        let html = fs.readFileSync(bioPagePath, 'utf8');

        // Inject OG Tags if user found
        if (user) {
            const title = `${user.nickname} | ${user.role || 'Productor'} - OFFSZN`;
            const description = user.bio || `Escucha los últimos beats y recursos de ${user.nickname} en OFFSZN.`;
            const image = user.avatar_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
            const url = `https://offszn.lat/b/${user.nickname}`;

            const ogTags = `
    <!-- Dynamic Open Graph Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
            `;

            // Insert tags right after <head>
            html = html.replace('<head>', `<head>\n${ogTags}`);
            // Also replace the standard title
            html = html.replace('<title>Link in Bio - OFFSZN</title>', `<title>${title}</title>`);
        }

        res.send(html);

    } catch (err) {
        console.error("Error serving Biolink:", err);
        // Fallback to static version
        res.sendFile(bioPagePath);
    }
});

// --- 3.6 PROFILE SHORTCUT ROUTE (/:username) ---
// Supports both /@username and /username
app.get(['/@:username', '/:username'], (req, res, next) => {
    const { username } = req.params;

    // 1. Reserved Words / Known Routes Exclusion
    const reserved = [
        'api', 'auth', 'dashboard', 'login', 'register', 'admin',
        'css', 'script', 'images', 'favicon.ico', '404', 'robots.txt',
        'pages', 'welcome', 'home', 'index', 'health', 'status'
    ];
    if (reserved.includes(username)) return next();

    // 2. Ignore file extensions (e.g. style.css)
    // FIX: Allow dots if it's an explicit profile route (/@...)
    const isExplicitProfile = req.path.startsWith('/@');

    // Only skip if dot exists AND it's NOT an explicit /@ route
    if (username.includes('.') && !isExplicitProfile) {
        return next();
    }

    // 3. Ignore if mapped to a real folder/file that static middleware missed
    const localPath = path.join(rootPath, username);
    if (fs.existsSync(localPath)) return next();

    // Serve Profile
    const profilePage = path.join(rootPath, 'perfil-publico.html');
    if (fs.existsSync(profilePage)) {
        res.sendFile(profilePage);
    } else {
        next();
    }
});

// --- 5. 404 HANDLER (MUST BE LAST) ---
app.use((req, res, next) => {
    // Si llegamos aquí, no se encontró ninguna ruta anterior ni archivo estático
    // Servimos 404.html si no es una petición API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint Not Found' });
    }

    // Servir 404.html con status 404 real
    res.status(404).sendFile(path.join(rootPath, '404.html'));
});

// --- 6. GLOBAL ERROR HANDLER ---
// Captura cualquier error asíncrono o síncrono no controlado (Fase 4 Seguridad)
app.use((err, req, res, next) => {
    console.error(`[Server Error] en ${req.method} ${req.url}:`, err.message);

    // Evitar romper la app si las cabeceras ya se eviaron
    if (res.headersSent) {
        return next(err);
    }

    const status = err.status || err.statusCode || 500;

    res.status(status).json({
        error: "Ocurrió un error interno en el servidor. Por favor intenta de nuevo más tarde."
    });
});

// Chequeo de BD
checkConnection()

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`)
    console.log(`🌐 Accede a tu web en: http://localhost:${PORT}`)
    console.log(`TIME: ${new Date().toISOString()}`)
    // Touching again
})
