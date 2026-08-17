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
import studioRoutes from './infrastructure/http/routes/studio.routes.js';
import imagekitRoutes from './infrastructure/http/routes/imagekit.routes.js';
// import chatbotRouter from './routes/chatbot.js';
import profileRoutes from './infrastructure/http/routes/profile.routes.js';
// import reelsRoutes from './infrastructure/http/routes/reels.routes.js';
import { handleMercadoPagoWebhook } from './infrastructure/http/controllers/OrderController.js';
import chatRoutes from './infrastructure/http/routes/chat.routes.js';
import paypalRoutes from './infrastructure/http/routes/paypal.routes.js';
import r2Routes from './infrastructure/http/routes/r2.routes.js';
import subscriptionRoutes from './infrastructure/http/routes/subscription.routes.js';
import subscriptionV2Routes from './infrastructure/http/routes/subscription-v2.routes.js';
import requestRoutes from './infrastructure/http/routes/request.routes.js';
import youtubeRoutes from './infrastructure/http/routes/youtube.routes.js';
import youtubeSyncRoutes from './infrastructure/http/routes/youtube-sync.routes.js';
import analyzerRoutes from './infrastructure/http/routes/analyzer.routes.js';
import pluginLicensingRoutes from './infrastructure/http/routes/plugin-licensing.routes.js';
import calendarRoutes from './infrastructure/http/routes/calendar.routes.js';
import { checkAndSendRemindersInternal } from './infrastructure/http/controllers/CalendarController.js';
import { runSubscriptionScavenger } from './infrastructure/services/subscription-scavenger.js';

import { submitNegotiation, respondNegotiation, generatePurchaseToken, validatePurchaseToken, reportIssue } from './infrastructure/http/controllers/NegotiationController.js';
import { authenticateTokenMiddleware } from './infrastructure/middlewares/authenticateTokenMiddleware.js';
import { globalLimiter } from './infrastructure/middlewares/rateLimiter.middleware.js';





const app = express();
app.disable('x-powered-by'); // Deshabilita el header que delata el uso de Express
app.set('trust proxy', 1); // Confiar en el proxy de Render para express-rate-limit

// --- AGENT HUB OBFUSCATION KEY ---
const AGENT_ACCESS_KEY = process.env.AGENT_ACCESS_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// On Vercel, ESM→CJS compilation can break import.meta.url path resolution.
// process.cwd() always returns /var/task/ (the project root) in Vercel Lambda.
const rootPath = process.env.VERCEL ? process.cwd() : path.join(__dirname, '../../');

// --- 0. SECURITY HEADERS (MANDATORY FOR FFMPEG WASM) ---
app.use((req, res, next) => {
    const ffmpegPaths = [
        '/legal/offszn-debug',
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

// --- 0.1 SUBDOMAIN DETECTION MIDDLEWARE ---
app.use((req, res, next) => {
    const host = req.headers.host;
    if (host && (host.endsWith('.offszn.lat') || host.endsWith('.localhost:3000'))) {
        const parts = host.split('.');
        const subdomain = parts[0];
        
        // Exclude reserved subdomains
        const reserved = ['www', 'api', 'admin', 'offszn', 'studio', 'cuenta', 'explorar'];
        if (!reserved.includes(subdomain) && parts.length >= (host.includes('localhost') ? 2 : 3)) {
            req.isSubdomain = true;
            req.subdomainUser = subdomain;
        }
    }
    next();
});

// --- 1. CONFIGURACIÓN CORS ROBUSTA ---
const allowedOrigins = [
    'https://offszn.lat',
    'https://www.offszn.lat',
    'http://localhost:3000'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        // Permite el dominio principal, localhost y cualquier subdominio de offszn.lat
        const isMainDomain = allowedOrigins.indexOf(origin) !== -1;
        const isSubdomain = origin.endsWith('.offszn.lat') || origin.endsWith('.localhost:3000');
        
        if (isMainDomain || isSubdomain || origin.startsWith('http://localhost') || origin === 'null') {
            callback(null, true);
        } else {
            console.log("⚠️ CORS Warning (dev):", origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'apikey', 'X-Client-Info', 'X-Supabase-Auth', 'Range', 'If-Match', 'If-None-Match'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Type', 'ETag'],
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
                "https://*.gstatic.com", "https://*.googleapis.com", "https://*.google.com", "https://*.googleusercontent.com",
                // PayPal
                "https://www.paypal.com", "https://www.sandbox.paypal.com",
                // EmailOctopus
                "https://eomail5.com", "https://*.eomail5.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com", "https://eomail5.com", "https://*.eomail5.com", "https://gallery.eo.page"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net", "data:", "https://cdnjs.cloudflare.com", "https://gallery.eo.page"],
            imgSrc: ["'self'", "data:", "blob:",
                "https://images.unsplash.com", "https://*.supabase.co",
                "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com",
                "https://res.cloudinary.com", "https://ik.imagekit.io", "https://*.imagekit.io", "https://via.placeholder.com",
                "https://placehold.co", "https://*.gstatic.com", "https://upload.wikimedia.org", "https://raw.githubusercontent.com", "https://render.com", "https://www.yape.com.pe", "https://cdn.jsdelivr.net",
                "https://grainy-gradients.vercel.app",
                "https://*.ytimg.com", "https://*.ggpht.com", "https://*.googleusercontent.com",
                "https://ui-avatars.com",
                // PayPal
                "https://www.paypalobjects.com", "https://*.paypal.com",
                "https://offszn.lat", "https://*.offszn.lat", "http://localhost:*"
            ],
            mediaSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com", "https://res.cloudinary.com", "https://offszn.lat", "https://*.offszn.lat", "http://localhost:*"],
            connectSrc: ["'self'", "blob:",
                "https://*.supabase.co", "wss://*.supabase.co",
                "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com", "https://*.r2.dev",
                "https://api.emailjs.com",
                "https://eomail5.com", "https://*.eomail5.com",
                // PayPal
                "https://api.paypal.com", "https://www.paypal.com", "https://www.sandbox.paypal.com",
                "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com",
                "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://offszn.lat", "https://*.offszn.lat",
                "http://localhost:*",
                "https://*.googleapis.com", "https://accounts.google.com", "https://apis.google.com",
                "https://*.ytimg.com", "https://*.ggpht.com", "https://*.googleusercontent.com",
                "https://get.geojs.io", "https://*.geojs.io", "https://ipapi.co",
                "https://api.ipify.org", "https://ipinfo.io"
            ],
            frameSrc: ["'self'",
                "https://www.youtube.com", "https://www.youtube-nocookie.com",
                "https://open.spotify.com",
                // PayPal
                "https://www.paypal.com", "https://www.sandbox.paypal.com",
                "https://accounts.google.com", "https://*.googleapis.com", "https://apis.google.com",
                // EmailOctopus (for hidden iframe form response)
                "https://eomail5.com", "https://*.eomail5.com"
            ],
            formAction: ["'self'", "https://eomail5.com", "https://*.eomail5.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // 🔥 REQUIRED: Without this, Google OAuth popup can't send token back to opener
    crossOriginResourcePolicy: { policy: "cross-origin" }, // 🔥 REQUIRED: Allows local testing to load production images via <img> without being blocked by CORP.
    hsts: {
        maxAge: 31536000, // 1 año en segundos
        includeSubDomains: true,
        preload: true
    }
}));

// Aplicar CORS a todo
app.use(cors(corsOptions));

// DEBUG LOGGER desactivado en producción (ver seguridad.md)\n// app.use((req, res, next) => { console.log(`📡 Request: ${req.method} ${req.originalUrl}`); next(); });

// --- 2.1 PARSEO DE JSON & COOKIES ---
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, EMAILJS_PUBLIC_KEY, EMAILOCTOPUS_API_KEY, EMAILOCTOPUS_LIST_ID } from '../src/shared/config/config.js'

// --- PUBLIC ENVIRONMENT VARIABLES ---
app.get('/env.js', (req, res) => {
    res.type('.js');
    res.send(`
        window.SUPABASE_URL = "${SUPABASE_URL || 'https://qtjpvztpgfymjhhpouuq.supabase.co'}";
        window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw'}";
        window.EMAILJS_PUBLIC_KEY = "${EMAILJS_PUBLIC_KEY || 'If_WAVcuXiGSPp2SB'}";
        window.PAYPAL_CLIENT_ID = "${process.env.PAYPAL_CLIENT_ID || ''}";
        window.IMAGEKIT_URL_ENDPOINT = "${process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/offszn/'}";
    `);
});

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --- 2.2.1 AGENT HUB STEALTH GATE (High Priority) ---
app.get('/system/v2/config/dump', (req, res, next) => {
    const accessKey = req.headers['x-offszn-agent-access'] || req.cookies['offszn_agent_access'];
    if (!AGENT_ACCESS_KEY || accessKey !== AGENT_ACCESS_KEY) return res.status(404).send('Not found');
    
    const agentHubPath = path.join(__dirname, '../public/system-logs.html');
    if (fs.existsSync(agentHubPath)) return res.sendFile(agentHubPath);
    res.status(200).json({ status: 'diagnostic_mode', message: 'System logs placeholder' });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- 2.3 GLOBAL RATE LIMITING ---
// Protege toda la aplicación contra ataques de fuerza bruta básicos o Ddos
app.use('/api', r2Routes);
app.use('/api', globalLimiter);

// --- RESTO DE RUTAS API (Omitidas para evitar borrado accidental) ---
// (Líneas 139-173 del archivo original que fueron movidas o borradas se restauran a continuación)
// app.use('/api/reels', reelsRoutes);
app.post('/api/orders/mercadopago-webhook', handleMercadoPagoWebhook);
app.post('/api/negotiate', submitNegotiation);
app.post('/api/negotiate/respond', authenticateTokenMiddleware, respondNegotiation);
app.post('/api/negotiate/purchase-token', authenticateTokenMiddleware, generatePurchaseToken);
app.get('/api/negotiate/validate-token', validatePurchaseToken);
app.post('/api/negotiate/report', authenticateTokenMiddleware, reportIssue);



// --- 2.4 NEWSLETTER (EMAIL OCTOPUS) ---
app.post('/api/newsletter/subscribe', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Se requiere un correo electrónico.' });

    try {
        const response = await fetch(`https://emailoctopus.com/api/1.1/lists/${EMAILOCTOPUS_LIST_ID}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: EMAILOCTOPUS_API_KEY,
                email_address: email,
                status: 'SUBSCRIBED'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('EmailOctopus Error:', data);

            // Handle common errors (e.g. already subscribed)
            if (data.error && data.error.code === 'MEMBER_EXISTS_WITH_EMAIL_ADDRESS') {
                return res.status(200).json({ success: true, message: '¡Ya estás suscrito! 🎉' });
            }

            return res.status(response.status).json({
                error: 'No pudimos procesar tu suscripción. Intenta de nuevo.'
            });
        }

        res.status(200).json({ success: true, message: '¡Gracias por suscribirte! 🎉' });

    } catch (error) {
        console.error('Newsletter Backend Error:', error);
        res.status(500).json({ error: 'Error interno al procesar la suscripción.' });
    }
});

// --- 2.5 API ROUTING (MOUNTED ORDER MATTERS) ---
// Groups routers by their authentication strategy to avoid intercepting public paths.

// A. PUBLIC & HYBRID ROUTERS (Handle their own auth internally or are fully public)
app.use('/api', publicRoutes);
app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', requestRoutes);
app.use('/api/analyzer', analyzerRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/imagekit', imagekitRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', subscriptionV2Routes);
app.use('/api/plugin', pluginLicensingRoutes);
app.use('/api', r2Routes);
app.use('/api/imagekit', imagekitRoutes);
app.use('/api', paypalRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', youtubeSyncRoutes);
app.use('/api', calendarRoutes);

// B. PROTECTED ROUTERS (Use global router.use(authenticateTokenMiddleware) internally)
// These MUST come after public/hybrid ones if mounted on the same prefix (/api)
app.use('/api', cartRoutes);
app.use('/api', userRoutes);
app.use('/api', chatRoutes);

// C. SPECIFIC PREFIX ROUTERS
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api/reels', reelsRoutes);

// --- 3. CLEAN URLS & STATIC FILES (MIDDLEWARE) ---

// A. Security Block (Prevent access to backend source, internal tools & data leaks)
app.use((req, res, next) => {
    const sensitiveStart = [
        '/server',
        '/.env',
        '/.git',
        '/render.yaml',
        '/node_modules',
        '/backend',
        '/.vscode',
        '/.agents',
        '/.gemini',
        '/owner',
        '/database'
    ];

    const sensitiveExtensions = ['.csv', '.sql', '.yaml', '.yml', '.env', '.log', '.sh', '.bat', '.ps1'];
    const pathLower = req.path.toLowerCase();

    // 1. Check blocked directory prefixes
    if (sensitiveStart.some(s => pathLower.startsWith(s))) {
        return res.status(403).send('Forbidden');
    }

    // 2. Block sensitive file extensions
    if (sensitiveExtensions.some(ext => pathLower.endsWith(ext))) {
        return res.status(403).send('Forbidden');
    }

    // 3. Block specific sensitive root scripts/files
    if (
        pathLower.includes('package.json') ||
        pathLower.includes('package-lock.json') ||
        pathLower.includes('schema.json') ||
        pathLower.startsWith('/n8n_') ||
        pathLower.endsWith('.config.js')
    ) {
        return res.status(403).send('Forbidden');
    }

    next();
});

// --- 301 LEGACY REDIRECTS (from _redirects - Vercel ignores that file) ---
// Fix Google Search Console 404s for old /product.html URLs
app.get('/product.html', (req, res) => {
    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    res.redirect(301, `/producto.html${qs}`);
});
app.get('/product', (req, res) => {
    const qs = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    res.redirect(301, `/producto.html${qs}`);
});
app.get('/recursos/x-flow-analyzer', (req, res) => {
    res.redirect(301, '/plugins/x-flow-analyzer.html');
});

// --- 3.0 WILLIE INSPIRED DEDICATED DIRECT ROUTES (Clean URLs without redirects) ---
app.get(['/willieinspired', '/@willieinspired'], (req, res) => {
    const willieLandingPath = path.join(rootPath, 'willieinspired/index.html');
    if (fs.existsSync(willieLandingPath)) {
        return res.sendFile(willieLandingPath);
    }
    return res.redirect(301, '/perfilpro.html?user=willieinspired');
});

app.get(['/willieinspired/:slug', '/@willieinspired/:slug'], (req, res, next) => {
    const { slug } = req.params;
    const cleanSlug = slug.replace(/\.html$/, '');
    const customProductPath = path.join(rootPath, 'willieinspired', `${cleanSlug}.html`);
    if (fs.existsSync(customProductPath)) {
        return res.sendFile(customProductPath);
    }
    next();
});

// B. Clean URLs (Force Redirects & Internal Rewrites)
app.use((req, res, next) => {
    // Skip API routes, willieinspired, and FFmpeg/Debug folders to avoid loops or blocking
    const skipPaths = ['/api', '/ffmpeg_clean', '/offszn-debug', '/legal/offszn-debug', '/env.js', '/components', '/willieinspired', '/@willieinspired'];
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
        // Fallback to pages directory for clean URLs like /login, /register, etc.
        let targetPath = req.path;
        if (targetPath.endsWith('/purchase-succes')) {
            targetPath = targetPath.replace('/purchase-succes', '/purchase-success');
        }
        const possiblePagesHtml = path.join(rootPath, 'pages', targetPath.replace(/^\/pages/, '') + '.html');
        if (fs.existsSync(possiblePagesHtml)) {
            return res.sendFile(possiblePagesHtml);
        }
    }

    next();
});

// C1. Serve Static Files from Server Public (Prioritize this for moved assets)
// Use rootPath-relative paths so they work on both local and Vercel
const publicPath = path.join(rootPath, 'public');
const serverPublicPath = path.join(rootPath, 'server/public');
app.use(express.static(publicPath));
app.use(express.static(serverPublicPath));

// Serve everything from rootPath — CSS, JS, images, HTML files, etc.
app.use(express.static(rootPath, { dotfiles: 'deny', redirect: false }));

// --- 3.3.5 SERVER-SIDE ID OBFUSCATOR (Sync with script/id-obfuscator.js) ---
const OBF_CHARS = 'qL8zF1Gk7XwNjR4yvB5tM6dncb9sPp2hQr3JmKW0ZTDVagHflSx_';
const OBF_BASE = OBF_CHARS.length;
const OBF_SALT = 74;
const OBF_MULT = 321;

function serverDecodeId(str) {
    if (!str) return null;
    if (str === '4LB') return 118; // Legacy skip
    let n = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const index = OBF_CHARS.indexOf(char);
        if (index === -1) return null;
        n = n * OBF_BASE + index;
    }
    if ((n - OBF_SALT) % OBF_MULT !== 0) return null;
    return Math.floor((n - OBF_SALT) / OBF_MULT);
}

function serverEncodeId(num) {
    if (num === null || num === undefined || isNaN(num)) return '';
    let n = Number(num) * OBF_MULT + OBF_SALT;
    if (n === 0) return OBF_CHARS[0];
    let res = '';
    while (n > 0) {
        res = OBF_CHARS[n % OBF_BASE] + res;
        n = Math.floor(n / OBF_BASE);
    }
    return res;
}

// --- 3.3.6 301 REDIRECTS FOR LEGACY /product.html TO FIX GSC 404s ---
app.get(['/product.html', '/product'], (req, res) => {
    const id = req.query.id || req.query.p;
    if (id) {
        return res.redirect(301, `/producto.html?id=${encodeURIComponent(id)}`);
    }
    return res.redirect(301, '/producto.html');
});

// --- 3.3.7 DYNAMIC SITEMAP.XML GENERATOR (Includes All Producers & Products) ---
let sitemapCache = null;
let sitemapCacheTime = 0;
const SITEMAP_CACHE_DURATION = 3600 * 1000; // 1 hora de cache en memoria

app.get('/sitemap.xml', async (req, res) => {
    try {
        const now = Date.now();
        if (sitemapCache && (now - sitemapCacheTime < SITEMAP_CACHE_DURATION)) {
            res.setHeader('Content-Type', 'application/xml');
            return res.send(sitemapCache);
        }

        const { supabase: db } = await import('./infrastructure/database/connection.js');
        const today = new Date().toISOString().split('T')[0];

        // 1. Static Core Pages
        const staticPages = [
            { loc: 'https://offszn.lat/', priority: '1.0', changefreq: 'daily' },
            { loc: 'https://offszn.lat/explorar.html', priority: '0.9', changefreq: 'daily' },
            { loc: 'https://offszn.lat/search.html', priority: '0.9', changefreq: 'daily' },
            { loc: 'https://offszn.lat/comunidad/productores.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/cursos/inicio.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/drum-kits.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/presets.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/one-shots.html', priority: '0.7', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/samples-loops.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/recursos-gratis.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/recursos/plugins.html', priority: '0.7', changefreq: 'monthly' },
            { loc: 'https://offszn.lat/plugins/all.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/plugins/easy-mix.html', priority: '0.9', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/plugins/easy-master.html', priority: '0.9', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/plugins/inka-kola.html', priority: '0.9', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/plugins/offszn-recorder.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/plugins/x-flow-analyzer.html', priority: '0.8', changefreq: 'weekly' },
            { loc: 'https://offszn.lat/legal/ayuda-y-contacto.html', priority: '0.5', changefreq: 'monthly' }
        ];

        // 2. Fetch Public Producers from DB
        const { data: producers } = await db
            .from('users')
            .select('nickname, updated_at')
            .not('nickname', 'is', null)
            .limit(1000);

        // 3. Fetch Active Products from DB
        const { data: products } = await db
            .from('products')
            .select('id, public_slug, product_type, updated_at')
            .neq('status', 'deleted')
            .limit(2000);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Add Static Pages
        for (const page of staticPages) {
            xml += '  <url>\n';
            xml += `    <loc>${page.loc}</loc>\n`;
            xml += `    <lastmod>${today}</lastmod>\n`;
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += '  </url>\n';
        }

        // Add Producers (@username)
        if (producers && producers.length > 0) {
            for (const prod of producers) {
                if (!prod.nickname || prod.nickname.includes('/') || prod.nickname.includes(' ')) continue;
                const lastmod = prod.updated_at ? prod.updated_at.split('T')[0] : today;
                xml += '  <url>\n';
                xml += `    <loc>https://offszn.lat/@${encodeURIComponent(prod.nickname)}</loc>\n`;
                xml += `    <lastmod>${lastmod}</lastmod>\n`;
                xml += '    <changefreq>daily</changefreq>\n';
                xml += '    <priority>0.8</priority>\n';
                xml += '  </url>\n';
            }
        }

        // Add Products (/p/code or /beat/slug)
        if (products && products.length > 0) {
            for (const item of products) {
                const code = serverEncodeId(item.id);
                let loc = `https://offszn.lat/p/${code}`;
                if (item.public_slug) {
                    const type = (item.product_type || 'beat').toLowerCase();
                    let prefix = 'beat';
                    if (type.includes('drumkit')) prefix = 'drumkit';
                    else if (type.includes('loopkit')) prefix = 'loopkit';
                    else if (type.includes('kit')) prefix = 'kit';
                    else if (type.includes('preset') || type.includes('voces')) prefix = 'preset';
                    else if (type.includes('sample')) prefix = 'sample';
                    else if (type.includes('instrumento')) prefix = 'instrumento';
                    else if (type.includes('plugin')) prefix = 'plugin';
                    else if (type.includes('plantilla')) prefix = 'plantilla';
                    loc = `https://offszn.lat/${prefix}/${item.public_slug}`;
                }
                const lastmod = item.updated_at ? item.updated_at.split('T')[0] : today;
                xml += '  <url>\n';
                xml += `    <loc>${loc}</loc>\n`;
                xml += `    <lastmod>${lastmod}</lastmod>\n`;
                xml += '    <changefreq>weekly</changefreq>\n';
                xml += '    <priority>0.8</priority>\n';
                xml += '  </url>\n';
            }
        }

        xml += '</urlset>';

        sitemapCache = xml;
        sitemapCacheTime = now;

        res.setHeader('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (err) {
        console.error('[Sitemap Generator] Error:', err.message);
        // Fallback to static sitemap if DB error
        const staticSitemap = path.join(rootPath, 'sitemap.xml');
        if (fs.existsSync(staticSitemap)) {
            res.setHeader('Content-Type', 'application/xml');
            return res.sendFile(staticSitemap);
        }
        res.status(500).send('Error generating sitemap');
    }
});

// --- 3.3.8 OG IMAGE PROXY (Lightweight redirect for social media bots) ---
app.get('/api/og-image/:productId', async (req, res) => {
    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        const { getPresignedDownloadUrl } = await import('./infrastructure/services/r2-storage.service.js');
        
        const productId = parseInt(req.params.productId, 10);
        if (isNaN(productId)) return res.status(400).send('Invalid product ID');

        const { data: product } = await db.from('products').select('image_url, storage_version').eq('id', productId).maybeSingle();
        if (!product?.image_url) return res.redirect('https://offszn.lat/images/LOGO%20OFFSZN.webp');

        let imageUrl = product.image_url;
        const version = product.storage_version || 'v2';
        
        if (imageUrl.startsWith('http')) {
            if (imageUrl.includes('r2.cloudflarestorage.com')) {
                // Private R2 URL — extract key and sign it
                try {
                    const urlObj = new URL(imageUrl);
                    const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    const signedUrl = await getPresignedDownloadUrl(key, 600, version);
                    if (signedUrl) return res.redirect(signedUrl);
                } catch (e) {}
            }
            // Already a public URL (ImageKit, etc.)
            return res.redirect(imageUrl);
        }
        
        // Relative path
        if (version === 'supabase') {
            return res.redirect(`https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products/${imageUrl}`);
        }
        
        // R2 v1/v2 — sign it
        const signedUrl = await getPresignedDownloadUrl(imageUrl, 600, version);
        if (signedUrl) return res.redirect(signedUrl);
        
        // Last fallback — try Supabase public
        return res.redirect(`https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products/${imageUrl}`);
    } catch (err) {
        console.error('[OG Image Proxy] Error:', err.message);
        return res.redirect('https://offszn.lat/images/LOGO%20OFFSZN.webp');
    }
});

// --- 3.4 PRODUCT SHORTCUT ROUTES (SEO Friendly with Dynamic OG Tags & Clean Canonicals) ---
app.get([
    '/beat/:slug', '/kit/:slug', '/drumkit/:slug', '/loopkit/:slug',
    '/preset/:slug', '/plantilla/:slug', '/sample/:slug',
    '/instrumento/:slug', '/plugin/:slug', '/voces/:slug',
    '/p/:code'
], async (req, res, next) => {
    const { slug, code } = req.params;
    const productPagePath = path.join(rootPath, 'producto.html');
    if (!fs.existsSync(productPagePath)) return next();

    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        let productId = null;
        let productSlug = slug;

        // 1. Resolve ID or Slug
        if (code) {
            productId = serverDecodeId(code);
        } else if (slug) {
            const parts = slug.split('-');
            const potentialCode = parts.pop();
            productId = serverDecodeId(potentialCode);
            if (!productId) productSlug = slug; // Fallback to manual slug
        }

        // 2. Fetch Product Data
        let query = db.from('products').select('*, users!products_producer_id_fkey(nickname, avatar_url)').neq('status', 'deleted');
        if (productId) {
            query = query.eq('id', productId);
        } else {
            query = query.eq('public_slug', productSlug);
        }

        const { data: product } = await query.maybeSingle();

        // 3. Return real 404 if product does not exist (Prevents Soft 404s in GSC)
        if (!product) {
            return res.status(404).sendFile(path.join(rootPath, '404.html'));
        }

        let html = fs.readFileSync(productPagePath, 'utf8');

        const producerName = product.users?.nickname || 'Productor';
        const title = `${product.name} - ${producerName} | OFFSZN`;
        const price = product.is_free ? 'GRATIS' : `$${product.price_basic || '0.00'}`;
        const description = product.description 
            ? product.description.substring(0, 300) + '...'
            : `Descarga "${product.name}" por ${producerName}. ${price} en OFFSZN.lat`;
        
        const SUPABASE_PUBLIC_STORAGE = 'https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products';
        let image = product.image_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
        const version = product.storage_version || 'v2';
        
        if (image.startsWith('http')) {
            if (image.includes('r2.cloudflarestorage.com')) {
                try {
                    const urlObj = new URL(image);
                    let key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    if (version === 'v2') {
                        image = `https://offszn.lat/api/r2-public/${key}`;
                    } else {
                        image = `${SUPABASE_PUBLIC_STORAGE}/${key}`;
                    }
                } catch (e) {
                    image = `https://offszn.lat/api/r2-public/${image}`;
                }
            }
        } else {
            if (version === 'v2') {
                image = `https://offszn.lat/api/r2-public/${image}`;
            } else {
                image = `${SUPABASE_PUBLIC_STORAGE}/${image}`;
            }
        }

        const url = `https://offszn.lat${req.originalUrl.split('?')[0]}`;

        const ogTags = `
    <!-- Dynamic Product OG Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="OFFSZN">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
        `;

        const productSchema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.name,
            "image": image,
            "description": product.description || description,
            "sku": product.id,
            "brand": { "@type": "Brand", "name": "OFFSZN" },
            "offers": {
                "@type": "Offer",
                "url": url,
                "priceCurrency": "USD",
                "price": product.price_basic || 0,
                "availability": "https://schema.org/InStock"
            }
        };
        const schemaTag = `<script type="application/ld+json">${JSON.stringify(productSchema)}</script>`;

        // CRITICAL: Replace static canonical with the product-specific canonical URL
        const canonicalTag = `<link rel="canonical" href="${url}">`;
        if (html.includes('<link rel="canonical"')) {
            html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
        } else {
            html = html.replace('<head>', `<head>\n    ${canonicalTag}`);
        }

        html = html.replace('<head>', `<head>\n${ogTags}\n    ${schemaTag}`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        res.send(html);

    } catch (err) {
        console.error("Error serving dynamic product page:", err);
        res.status(404).sendFile(path.join(rootPath, '404.html'));
    }
});

// --- 3.4.5 SERVICE SHORTCUT ROUTE (/servicio/:slug) ---
app.get('/servicio/:slug', async (req, res, next) => {
    const { slug } = req.params;
    const servicePagePath = path.join(rootPath, 'servicio.html');
    if (!fs.existsSync(servicePagePath)) return next();

    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        
        // Extract parts: [title]-[code]-[nickname]
        const segments = slug.split('-').filter(p => p.trim());
        if (segments.length < 2) return res.sendFile(servicePagePath);

        const nickname = segments[segments.length - 1];
        const code = segments[segments.length - 2];
        const targetId = serverDecodeId(code) || code;

        // Fetch user basic data for OG Tags
        const { data: user } = await db
            .from('users')
            .select('id, nickname, avatar_url, socials')
            .eq('nickname', nickname)
            .single();

        let html = fs.readFileSync(servicePagePath, 'utf8');

        if (user) {
            const services = user.socials?.custom_services || [];
            const service = services.find(s => s.id === targetId || s.id === `servicios_offszn_${targetId}`);
            
            if (service) {
                const title = `${service.title} | ${user.nickname} - OFFSZN`;
                const description = service.description 
                    ? service.description.substring(0, 160) + '...'
                    : `Contrata el servicio "${service.title}" de ${user.nickname} en OFFSZN.lat`;
                
                let image = user.avatar_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
                const url = `https://offszn.lat/servicio/${slug}`;

                const ogTags = `
    <!-- Dynamic Service OG Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
                `;

                const canonicalTag = `<link rel="canonical" href="${url}">`;
                if (html.includes('<link rel="canonical"')) {
                    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
                } else {
                    html = html.replace('<head>', `<head>\n    ${canonicalTag}`);
                }

                html = html.replace('<head>', `<head>\n${ogTags}`);
                html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
            }
        }

        res.send(html);

    } catch (err) {
        console.error("Error serving service page:", err);
        res.sendFile(servicePagePath);
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
            let image = user.avatar_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
            if (image && image.startsWith('http')) {
                // If it's a private R2 URL, redirect to proxy
                if (image.includes('r2.cloudflarestorage.com')) {
                    try {
                        const urlObj = new URL(image);
                        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                        image = `https://offszn.lat/api/r2-public/${key}`;
                    } catch (e) {}
                }
            } else if (image && !image.startsWith('http')) {
                // Relative path, use proxy
                image = `https://offszn.lat/api/r2-public/${image}`;
            }

            const url = `https://offszn.lat/b/${user.nickname}`;

            const ogTags = `
    <!-- Dynamic Open Graph Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="profile">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
            `;

            const canonicalTag = `<link rel="canonical" href="${url}">`;
            if (html.includes('<link rel="canonical"')) {
                html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
            } else {
                html = html.replace('<head>', `<head>\n    ${canonicalTag}`);
            }

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

// --- 3.5.5 PLAYLIST & CUSTOM USER SUB-ROUTES (/@:username/:slug) ---
app.get(['/@:username/:slug', '/:username/:slug'], async (req, res, next) => {
    const { username, slug } = req.params;

    // Custom product landings for willieinspired
    if (username === 'willieinspired') {
        const customProductPath = path.join(rootPath, 'willieinspired', `${slug}.html`);
        if (fs.existsSync(customProductPath)) {
            return res.sendFile(customProductPath);
        }
    }

    const playlistPagePath = path.join(rootPath, 'playlist.html');
    if (!fs.existsSync(playlistPagePath)) return next();

    // 1. Reserved Words Exclusion (same as profile)
    const reserved = ['api', 'auth', 'dashboard', 'login', 'register', 'admin', 'pages', 'legal', 'studio', 'comunidad', 'cursos',
        'plugins', 'css', 'script', 'scripts', 'libs', 'images', 'components', 'recursos', 'public', 'style', 'fonts',
        'videos', 'ayuda', 'build', 'cuenta', 'store-builder', 'offszn_flow', 'upload', 'previews'];
    if (reserved.includes(username)) return next();

    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        
        // Fetch user data
        const { data: user } = await db
            .from('users')
            .select('nickname, avatar_url, socials')
            .eq('nickname', username)
            .single();

        let html = fs.readFileSync(playlistPagePath, 'utf8');

        if (user) {
            const playlists = user.socials?.playlists || [];
            // Try to match by slug field, then by slugified title
            const playlist = playlists.find(p => p.slug === slug) || 
                           playlists.find(p => {
                               const autoSlug = p.title.toLowerCase()
                                   .replace(/[^a-z0-9]+/g, '-')
                                   .replace(/(^-|-$)+/g, '');
                               return autoSlug === slug;
                           });
            
            if (playlist) {
                const title = `${playlist.title} | @${user.nickname} - OFFSZN`;
                const description = `Escucha la playlist "${playlist.title}" de ${user.nickname} en OFFSZN.lat`;
                let image = playlist.cover_url || user.avatar_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
                const url = `https://offszn.lat/@${user.nickname}/${slug}`;

                const ogTags = `
    <!-- Dynamic Playlist OG Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="music.playlist">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
                `;

                const canonicalTag = `<link rel="canonical" href="${url}">`;
                if (html.includes('<link rel="canonical"')) {
                    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
                } else {
                    html = html.replace('<head>', `<head>\n    ${canonicalTag}`);
                }

                html = html.replace('<head>', `<head>\n${ogTags}`);
                html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
            }
        }

        res.send(html);

    } catch (err) {
        console.error("Error serving playlist page:", err);
        res.sendFile(playlistPagePath);
    }
});

// --- 3.6 PROFILE SHORTCUT ROUTE (/:username) ---
// Supports /@username, /username, and username.offszn.lat
app.get(['/@:username', '/:username', '/'], async (req, res, next) => {
    let username = req.params.username;

    // Handle Subdomain Root
    if (!username && req.isSubdomain) {
        username = req.subdomainUser;
    }

    if (!username) return next();

    // 1. Reserved Words / Known Routes Exclusion
    const reserved = [
        'api', 'auth', 'dashboard', 'login', 'register', 'admin',
        'css', 'script', 'scripts', 'images', 'favicon.ico', '404', 'robots.txt',
        'pages', 'welcome', 'home', 'index', 'health', 'status', 'components',
        'explorar', 'productores', 'feeds', 'reels', 'carrito', 'checkout',
        'transacciones', 'ajustes', 'subir-kit', 'mis-compras', 'notificaciones',
        'preferencias', 'favoritos', 'historial', 'mensajes', 'perfilpro',
        'siguiendo', 'search', 'comunidad', 'cursos', 'legal', 'recursos', 'planes', 'cuenta',
        'plugins', 'libs', 'style', 'fonts', 'videos', 'ayuda', 'build', 'public',
        'store-builder', 'upload', 'previews', 'offszn_flow', 'studio'
    ];
    if (reserved.includes(username)) return next();

    // 2. Ignore file extensions
    const isExplicitProfile = req.path.startsWith('/@');
    if (username.includes('.') && !isExplicitProfile) return next();

    // 3. Ignore real files
    const localPath = path.join(rootPath, username);
    if (fs.existsSync(localPath)) return next();

    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        const { data: user } = await db
            .from('users')
            .select('id, nickname, role, avatar_url, bio, template')
            .eq('nickname', username)
            .single();

        if (!user) {
            return res.status(404).sendFile(path.join(rootPath, '404.html'));
        }

        // --- SPECIAL: WILLIE INSPIRED CUSTOM LANDING ---
        if (username === 'willieinspired') {
            const willieLandingPath = path.join(rootPath, 'willieinspired/index.html');
            if (fs.existsSync(willieLandingPath)) {
                return res.sendFile(willieLandingPath);
            }
        }

        // --- TEMPLATE SELECTION ---
        let templateFile = 'perfil-publico.html';
        if (user.template === 'premium') {
            templateFile = 'perfil-deploy.html';
        } else if (user.template === 'editor_tienda') {
            templateFile = 'plantilla-editor-tienda.html';
        }
        
        const profilePagePath = path.join(rootPath, templateFile);
        if (!fs.existsSync(profilePagePath)) {
            // Fallback if premium template not found
            return res.sendFile(path.join(rootPath, 'perfil-publico.html'));
        }

        let html = fs.readFileSync(profilePagePath, 'utf8');

        // --- OG TAGS & INJECTION ---
        const title = `${user.nickname} | ${user.role || 'Productor'} - OFFSZN`;
        const description = user.bio 
            ? user.bio.substring(0, 160) + '...'
            : `Escucha los últimos beats y recursos de ${user.nickname} en OFFSZN.lat`;
        
        let image = user.avatar_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
        if (image && image.startsWith('http')) {
            if (image.includes('r2.cloudflarestorage.com')) {
                try {
                    const urlObj = new URL(image);
                    const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    image = `https://offszn.lat/api/r2-public/${key}`;
                } catch (e) {}
            }
        } else if (image && !image.startsWith('http')) {
            image = `https://offszn.lat/api/r2-public/${image}`;
        }

        const url = req.isSubdomain ? `https://${user.nickname}.offszn.lat` : `https://offszn.lat/@${user.nickname}`;

        const ogTags = `
    <!-- Dynamic Profile OG Tags -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="OFFSZN">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
        `;

        const personSchema = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": user.nickname,
            "url": url,
            "image": image,
            "description": user.bio || description,
            "jobTitle": user.role || "Productor Musical"
        };
        const schemaTag = `<script type="application/ld+json">${JSON.stringify(personSchema)}</script>`;

        // CRITICAL: Replace static canonical with the creator's specific canonical URL
        const canonicalTag = `<link rel="canonical" href="${url}">`;
        if (html.includes('<link rel="canonical"')) {
            html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonicalTag);
        } else {
            html = html.replace('<head>', `<head>\n    ${canonicalTag}`);
        }

        // Specific Premium Template Placeholders
        if (user.template === 'premium') {
            html = html.replace('</head>', `
                <script>
                    window.OFFSZN_PROFILE_USER = "${user.nickname}";
                    window.OFFSZN_USER_ID = "${user.id}";
                </script>
            </head>`);
        } else if (user.template === 'editor_tienda') {
            html = html.replace(/{{USER_NICKNAME}}/g, user.nickname);
            html = html.replace(/{{USER_NAME_HERO}}/g, user.nickname.toUpperCase());
            html = html.replace(/{{USER_BIO}}/g, user.bio || 'Productor Musical');
            html = html.replace('</head>', `
                <script>window.OFFSZN_USER_ID = "${user.id}";</script>
                <script src="/components/offszn_perfiles_profesionales/loader.js?v=22"></script>
            </head>`);
        }

        html = html.replace('<head>', `<head>\n${ogTags}\n    ${schemaTag}`);
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        res.send(html);

    } catch (err) {
        console.error("Error serving Profile:", err);
        res.status(404).sendFile(path.join(rootPath, '404.html'));
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

    // Mensaje amigable para errores de tamaño (413 Payload Too Large)
    if (err.type === 'entity.too.large' || status === 413) {
        return res.status(413).json({
            error: 'El archivo es demasiado grande. Intenta con una imagen más pequeña (máx. 30MB).'
        });
    }

    res.status(status).json({
        error: "Ocurrió un error interno en el servidor. Por favor intenta de nuevo más tarde."
    });
});

// Chequeo de BD
// Export Express app for Vercel Serverless Function & local servers
export default app;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
        console.log(`🌐 Accede a tu web en: http://localhost:${PORT}`);
        console.log(`TIME: ${new Date().toISOString()}`);

        // --- START AUTOMATED TASKS ---
        runSubscriptionScavenger();
        setInterval(runSubscriptionScavenger, 12 * 60 * 60 * 1000);
    });
}
