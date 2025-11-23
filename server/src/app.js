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
import chatRoutes from './infrastructure/http/routes/chat.routes.js';

const app = express()

const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'https://offszn.onrender.com'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    }
};

app.use(cors(corsOptions));

// Parseo JSON debe ir ANTES de las rutas
app.use(express.json())

// Rutas
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

checkConnection()

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`)
})