import express from 'express'
import cors from 'cors'
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
import chatbotRouter from './routes/chatbot.js';
import profileRoutes from './infrastructure/http/routes/profile.routes.js';
import { handleMercadoPagoWebhook } from './infrastructure/http/controllers/OrderController.js';
import chatRoutes from './infrastructure/http/routes/chat.routes.js';

const app = express()

// --- 1. CONFIGURACIÓN CORS ROBUSTA ---
const allowedOrigins = [
    'https://offszn.onrender.com',       // Tu Frontend Producción
    'https://offszn-academy.onrender.com', // Tu Backend (por si acaso)
    'http://localhost:5500',             // Local
    'http://127.0.0.1:5500',             // Local IP
    'http://127.0.0.1:5501'              // Local Live Server alt
];

const corsOptions = {
    origin: function (origin, callback) {
        // Imprimir en consola quién pide acceso (Vital para depurar en Render)
        console.log("📡 CORS Request from:", origin);

        // Permitir peticiones sin origen (como Postman o Server-to-Server)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error("⛔ Bloqueado por CORS:", origin);
            callback(new Error(`Origen ${origin} no permitido por CORS`));
        }
    },
    credentials: true, // ¡IMPORTANTE! Permite enviar cookies y headers Authorization
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 // Para navegadores legacy
};

// Aplicar CORS a todo
app.use(cors(corsOptions));
// Habilitar explícitamente el manejo de 'Preflight' (OPTIONS)
app.options('*', cors(corsOptions));

// --- 2. PARSEO DE JSON (Después de CORS, antes de rutas) ---
app.use(express.json())

// --- 3. RUTAS ---
// Webhook debe ir antes de cualquier middleware que altere el body (aunque aquí ya usamos json)
app.post('/api/orders/mercadopago-webhook', handleMercadoPagoWebhook);

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', chatbotRouter);
app.use('/api', profileRoutes);
app.use('/api', chatRoutes);

// Chequeo de BD
checkConnection()

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`)
  console.log(`🛡️ Origenes permitidos:`, allowedOrigins)
})