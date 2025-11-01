import express from 'express'
import cors from 'cors'
import { PORT } from '../src/shared/config/config.js'
import { checkConnection } from './infrastructure/database/connection.js'
import authRoutes from './infrastructure/http/routes/auth.routes.js';
import productRoutes from './infrastructure/http/routes/product.routes.js';
import cartRoutes from './infrastructure/http/routes/cart.routes.js';
import orderRoutes from './infrastructure/http/routes/order.routes.js';
import userRoutes from './infrastructure/http/routes/user.routes.js';
import adminRoutes from './infrastructure/http/routes/admin.routes.js';

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

checkConnection()

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`)
})
