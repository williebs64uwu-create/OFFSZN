import express from 'express'
import cors from 'cors'
import { PORT } from '../src/shared/config/config.js'
import { checkConnection } from './infrastructure/database/connection.js'
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

const app = express()
// --- CONFIGURACIÓN DE CORS ---
// Lista de dominios que SÍ tienen permiso de hablar con tu API
const allowedOrigins = [
    'http://localhost:5500',    // Para tus pruebas locales con Live Server
    'http://127.0.0.1:5500',   // Para tus pruebas locales
    'http://127.0.0.1:5501',
    'https://offszn.onrender.com' // ¡TU FRONTEND EN PRODUCCIÓN! 
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir si el origen está en la lista
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    }
};

app.use(cors(corsOptions));

app.post('/api/orders/mercadopago-webhook', 
    express.raw({type: 'application/json'}),
    handleMercadoPagoWebhook
);
app.use(express.json())

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', chatbotRouter);
app.use('/api', profileRoutes); // ✅ CAMBIADO: antes era '/api/profile'

checkConnection()

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`)
})
