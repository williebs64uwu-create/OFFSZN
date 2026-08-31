import { googleWalletService } from '../../services/googleWalletService.js';

export async function createWalletPass(req, res) {
    try {
        const { name, email, phone, customData } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'El email es obligatorio.' });
        }

        const result = await googleWalletService.createPass({
            name,
            email,
            phone,
            points: 100, // 100 Puntos de bienvenida
            customData: customData || {}
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error en createWalletPass controller:', error);
        res.status(500).json({ error: error.message || 'Error al generar el pase de Google Wallet.' });
    }
}

export async function sendBroadcastPush(req, res) {
    try {
        const { title, body, linkUrl, targetEmail } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'Título y mensaje son requeridos.' });
        }

        const result = await googleWalletService.broadcastPushNotification({
            title,
            body,
            linkUrl,
            targetEmail
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error en sendBroadcastPush controller:', error);
        res.status(500).json({ error: error.message || 'Error al enviar notificación push.' });
    }
}

export async function updateWalletPoints(req, res) {
    try {
        const { email, pointsChange, newTotal } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'El email es obligatorio.' });
        }

        const result = await googleWalletService.updateMemberPoints({
            email,
            pointsChange,
            newTotal
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error en updateWalletPoints controller:', error);
        res.status(500).json({ error: error.message || 'Error al actualizar puntos.' });
    }
}

export async function getWalletMembers(req, res) {
    try {
        const passes = googleWalletService.getPassesList();
        const status = googleWalletService.getPublicStatus();

        res.status(200).json({
            success: true,
            total: passes.length,
            members: passes,
            configStatus: status
        });
    } catch (error) {
        console.error('Error en getWalletMembers controller:', error);
        res.status(500).json({ error: error.message || 'Error al listar miembros.' });
    }
}

export async function getWalletStatus(req, res) {
    try {
        const status = googleWalletService.getPublicStatus();
        res.status(200).json({ success: true, status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function saveWalletConfig(req, res) {
    try {
        const { issuerId, clientEmail, privateKey, classId } = req.body;
        const result = googleWalletService.saveRuntimeConfig({
            issuerId,
            clientEmail,
            privateKey,
            classId
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error en saveWalletConfig controller:', error);
        res.status(500).json({ error: error.message || 'Error al guardar configuración.' });
    }
}
