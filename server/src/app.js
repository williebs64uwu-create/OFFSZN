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
import analyzerRoutes from './infrastructure/http/routes/analyzer.routes.js';

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
        if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin === 'null') {
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
                "https://*.ytimg.com", "https://*.ggpht.com", "https://*.googleusercontent.com",
                "https://ui-avatars.com",
                // PayPal
                "https://www.paypalobjects.com", "https://*.paypal.com"
            ],
            mediaSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "blob:",
                "https://*.supabase.co", "wss://*.supabase.co",
                "https://*.cloudflarestorage.com", "https://*.r2.cloudflarestorage.com", "https://*.r2.dev",
                "https://api.emailjs.com",
                "https://eomail5.com", "https://*.eomail5.com",
                // PayPal
                "https://api.paypal.com", "https://www.paypal.com", "https://www.sandbox.paypal.com",
                "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com",
                "https://cdn.jsdelivr.net", "https://unpkg.com", "https://offszn.lat",
                "https://offszn-oc7c.onrender.com", "https://*.onrender.com",
                "http://localhost:*",
                "https://*.googleapis.com", "https://accounts.google.com", "https://apis.google.com",
                "https://*.ytimg.com", "https://*.ggpht.com", "https://*.googleusercontent.com"
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
app.use('/api', r2Routes);
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

app.use('/api', subscriptionRoutes);
app.use('/api', youtubeRoutes);
app.use('/api', analyzerRoutes);

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
const serverPublicPath = path.join(__dirname, '../public'); // New server public path
app.use(express.static(publicPath));
app.use(express.static(serverPublicPath));

app.use(express.static(rootPath));

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

// --- 3.3.5 OG IMAGE PROXY (Lightweight redirect for social media bots) ---
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

// --- 3.4 PRODUCT SHORTCUT ROUTES (SEO Friendly with Dynamic OG Tags) ---
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

        let html = fs.readFileSync(productPagePath, 'utf8');

        if (product) {
            const producerName = product.users?.nickname || 'Productor';
            const title = `${product.name} - ${producerName} | OFFSZN`;
            const price = product.is_free ? 'GRATIS' : `$${product.price_basic || '0.00'}`;
            const description = product.description 
                ? product.description.substring(0, 300) + '...'
                : `Descarga "${product.name}" por ${producerName}. ${price} en OFFSZN.lat`;
            
            // Image Logic - Use DIRECT public URLs for maximum social media compatibility
            // The Supabase 'products' bucket is PUBLIC, so all covers stored there are directly accessible.
            // For R2 stored products, covers are also mirrored to Supabase OR we can use the proxy.
            const SUPABASE_PUBLIC_STORAGE = 'https://qtjpvztpgfymjhhpoouq.supabase.co/storage/v1/object/public/products';
            let image = product.image_url || 'https://offszn.lat/images/LOGO%20OFFSZN.webp';
            const version = product.storage_version || 'v2';
            
            if (image.startsWith('http')) {
                // Full URL — if it's a private R2 URL, extract key and try Supabase public
                // Note: v2 thumbnails are usually in R2, so route to r2-public if version is v2.
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
                // Relative path
                if (version === 'v2') {
                    image = `https://offszn.lat/api/r2-public/${image}`;
                } else {
                    image = `${SUPABASE_PUBLIC_STORAGE}/${image}`;
                }
            }

            const url = `https://offszn.lat${req.originalUrl}`;

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

            html = html.replace('<head>', `<head>\n${ogTags}\n    ${schemaTag}`);
            html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
        }

        res.send(html);

    } catch (err) {
        console.error("Error serving dynamic product page:", err);
        res.sendFile(productPagePath);
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
app.get(['/@:username', '/:username'], async (req, res, next) => {
    const { username } = req.params;

    // 1. Reserved Words / Known Routes Exclusion
    const reserved = [
        'api', 'auth', 'dashboard', 'login', 'register', 'admin',
        'css', 'script', 'images', 'favicon.ico', '404', 'robots.txt',
        'pages', 'welcome', 'home', 'index', 'health', 'status',
        'explorar', 'productores', 'feeds', 'reels', 'carrito', 'checkout',
        'transacciones', 'ajustes', 'subir-kit', 'mis-compras', 'notificaciones',
        'preferencias', 'favoritos', 'historial', 'mensajes', 'perfilpro',
        'siguiendo', 'search', 'comunidad', 'cursos', 'legal', 'recursos', 'planes', 'cuenta'
    ];
    if (reserved.includes(username)) return next();

    // 2. Ignore file extensions
    const isExplicitProfile = req.path.startsWith('/@');
    if (username.includes('.') && !isExplicitProfile) return next();

    // 3. Ignore real files
    const localPath = path.join(rootPath, username);
    if (fs.existsSync(localPath)) return next();

    // Serve Profile Template with OG Tags injected
    const profilePagePath = path.join(rootPath, 'perfil-publico.html');
    if (!fs.existsSync(profilePagePath)) return next();

    try {
        const { supabase: db } = await import('./infrastructure/database/connection.js');
        const { data: user } = await db
            .from('users')
            .select('nickname, role, avatar_url, bio')
            .eq('nickname', username)
            .single();

        let html = fs.readFileSync(profilePagePath, 'utf8');

        if (user) {
            const title = `${user.nickname} | ${user.role || 'Productor'} - OFFSZN`;
            const description = user.bio 
                ? user.bio.substring(0, 160) + '...'
                : `Escucha los últimos beats y recursos de ${user.nickname} en OFFSZN.lat`;
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


            const url = `https://offszn.lat/@${user.nickname}`;

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

            html = html.replace('<head>', `<head>\n${ogTags}\n    ${schemaTag}`);
            html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
        }

        res.send(html);

    } catch (err) {
        console.error("Error serving Profile:", err);
        res.sendFile(profilePagePath);
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
