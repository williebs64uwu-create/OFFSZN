import { Router } from 'express';

// Importamos los controladores
import { getUserByNickname, getProductsByNickname, getAllProducers, getUsersBulk } from '../controllers/UserController.js';
import { getAllProducts } from '../controllers/ProductController.js';
import { getLeaderboard } from '../controllers/LeaderboardController.js';
import { validateCoupon } from '../controllers/CouponController.js';
import { getPresignedDownloadUrl } from '../../services/r2-storage.service.js';

const router = Router();

// --- RUTAS PÚBLICAS (Cualquiera puede verlas sin login) ---

// 1. Obtener perfil público de usuario
router.get('/users/:nickname', getUserByNickname);
router.post('/users/bulk-info', getUsersBulk);


// 2. Obtener productos de un usuario específico
router.get('/users/:nickname/products', getProductsByNickname);

// 3. Obtener TODOS los productos (para el marketplace general)
router.get('/products', getAllProducts);

// 4. Obtener lista de PRODUCTORES (Esta es la que te fallaba)
router.get('/producers', getAllProducers);

// 5. Leaderboard (Top Productores)
router.get('/leaderboard', getLeaderboard);

// 6. Validar Cupón
router.post('/coupons/validate', validateCoupon);

// 7. Descarga del Instalador VST3 (OFFSZN CONVERTER)
router.get('/download/vst-installer', async (req, res) => {
    try {
        const url = await getPresignedDownloadUrl('OFFSZN_CONVERTER_Setup.exe', 3600, 'v3');
        if (url) {
            res.redirect(url);
        } else {
            res.status(404).send('Instalador no encontrado en el servidor.');
        }
    } catch (error) {
        console.error('Error generando enlace de descarga del VST:', error);
        res.status(500).send('Error interno al generar enlace de descarga.');
    }
});

// 8. Descarga del Instalador VST3 (OFFSZN EASY MIX - Windows)
router.get('/download/easymix-installer', (req, res) => {
    res.redirect('https://drive.google.com/file/d/1FXEF4CsSlClVKTZ8lzfq7027-4Pa-Jh1/view?usp=sharing');
});

// 8b. Descarga del Instalador VST3 (OFFSZN EASY MIX - macOS)
router.get('/download/easymix-mac-installer', (req, res) => {
    res.redirect('https://drive.google.com/file/d/1Wd_NgGsuc_FG6kjQOTjnF0qIodnK-iO4/view?usp=sharing');
});

// 8c. Descarga del Instalador VST3 (OFFSZN OMNI - Windows)
router.get(['/download/omni-installer', '/download/omni-win-installer'], (req, res) => {
    res.redirect('https://drive.google.com/file/d/179OVCmWJowkrDiwSeFpC3lqPR7Qn_1Zk/view?usp=sharing');
});

// 8d. Descarga del Instalador VST3 (OFFSZN OMNI - macOS)
router.get('/download/omni-mac-installer', (req, res) => {
    res.redirect('https://drive.google.com/file/d/1suMJLf1y-Y06NuLetNGojvHXBt8yzz4D/view?usp=sharing');
});

export default router;