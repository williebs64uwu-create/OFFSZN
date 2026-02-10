import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
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


const app = express()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.join(__dirname, '../../'); // Project Root

// --- 1. CONFIGURACIÓN CORS ROBUSTA ---
const allowedOrigins = [
    'https://offszn-oc7c.onrender.com',  // Nuevo Deploy en Producción
    'https://offszn.onrender.com',       // Tu Frontend Producción
    'https://offszn1.onrender.com',
    'https://offszn-academy.onrender.com', // Tu Backend
    'http://localhost:5500',             // Local
    'http://127.0.0.1:5500',             // Local IP
    'http://127.0.0.1:5501',              // Local Live Server alt
    'http://127.0.0.1:5502',
    'http://127.0.0.1:5503',
    'http://127.0.0.1:5504',
    'http://localhost:3000'              // Backend Self-Serving
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origen (como mobile apps o curl) y self-origin
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("⚠️ CORS Warning (dev):", origin);
            // En desarrollo, a veces conviene ser permisivo si usas localhost:3000
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200
};

// --- 1.1 SECURITY HEADERS (COOP/COEP) ---
// Critical for FFmpeg WASM (SharedArrayBuffer) AND Google OAuth (Popups)
app.use((req, res, next) => {
    // 1. Allow Popups to communicate (Google Auth)
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");

    // 2. Embedder Policy (Optional for v0.11 but good for v0.12)
    // If we use require-corp, we might need to serve assets with correct headers too.
    // For now, let's start with just COOP to fix Auth.
    // res.setHeader("Cross-Origin-Embedder-Policy", "require-corp"); 

    next();
});

// --- 2. MIDDLEWARES GLOBALES ---
// A. Security Check firstodo

// Aplicar CORS a todo
app.use(cors(corsOptions));

// DEBUG LOGGER
app.use((req, res, next) => {
    console.log(`📡 Request: ${req.method} ${req.originalUrl}`);
    next();
});

// --- 2. PARSEO DE JSON ---
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../src/shared/config/config.js'

// ... imports ...

// --- 2. PARSEO DE JSON & COOKIES ---
app.use(express.json())
app.use(cookieParser())

// --- 2.5 SECURITY MIDDLEWARE (DISABLED PER USER REQUEST) ---
/*
app.use((req, res, next) => {
    // Only protect dashboard routes
    if (!req.path.startsWith('/cuenta')) return next();

    // 1. Get Token from Cookie
    const token = req.cookies['sb-access-token'];

    if (!token) {
        console.log(`⛔ Security Block: No Token for ${req.path}`);
        return res.redirect('/index.html?error=unauthorized');
    }

    // 2. Verify Token (Server-Side)
    try {
        // Supabase signs with JWT_SECRET. We verify it here.
        jwt.verify(token, JWT_SECRET);
        // If valid, proceed
        next();
    } catch (err) {
        console.error(`⛔ Security Block: Invalid Token for ${req.path}`, err.message);
        // Clear the bad cookie
        res.clearCookie('sb-access-token');
        return res.redirect('/index.html?error=invalid_token');
    }
});
*/

// --- 4. RUTAS API ---
app.use('/api/reels', reelsRoutes); // Isolated and High Priority
app.post('/api/orders/mercadopago-webhook', handleMercadoPagoWebhook);

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api', chatbotRouter);
app.use('/api', profileRoutes);
app.use('/api', chatRoutes);
app.use('/api', paypalRoutes);
app.use('/api', r2Routes);


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
    // Skip API routes
    if (req.path.startsWith('/api')) return next();

    // 1. Force Redirect: Remove .html from browser address bar
    if (req.path.endsWith('.html')) {
        const cleanPath = req.path.replace(/\.html$/, '');
        const search = req.originalUrl.split('?')[1];
        const queryString = search ? '?' + search : '';

        // Special case: /index or /folder/index -> / or /folder
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
            // Check if it's the index.html specifically being called by '/'
            // Express handles '/' with express.static usually, but we want to be explicit
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
    '/voces/:slug'
], (req, res, next) => {
    const { slug } = req.params;
    // Serve Producto
    const productPage = path.join(rootPath, 'producto.html');
    if (fs.existsSync(productPage)) {
        res.sendFile(productPage);
    } else {
        next();
    }
});

// --- 3.5 PROFILE SHORTCUT ROUTE (/:username) ---
// Supports both /@username and /username
app.get(['/@:username', '/:username'], (req, res, next) => {
    const { username } = req.params;

    // 1. Reserved Words / Known Routes Exclusion
    const reserved = [
        'api', 'auth', 'dashboard', 'login', 'register', 'admin',
        'css', 'script', 'images', 'favicon.ico', '404', 'robots.txt',
        'pages', 'welcome', 'home', 'index'
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

// Chequeo de BD
checkConnection()

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`)
    console.log(`🌐 Accede a tu web en: http://localhost:${PORT}`)
})
