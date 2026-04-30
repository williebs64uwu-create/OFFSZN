import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../shared/config/config.js'; 

const expiresIn = '1h'; 

/**
 * Genera un token JWT.
 * @param {object} payload - Datos para incluir en el token (ej. { userId, email, isAdmin }).
 * @returns {string} El token JWT generado.
 * @throws {Error} Si JWT_SECRET no está definido.
 */
export const generateToken = (payload) => {
    if (!JWT_SECRET) {
        console.error("Error: JWT_SECRET no está definido en la configuración.");
        throw new Error('Error interno del servidor al generar token.'); 
    }
    try {
        return jwt.sign(payload, JWT_SECRET, { expiresIn });
    } catch (error) {
        console.error("Error al firmar el token JWT:", error);
        throw new Error('Error interno del servidor al generar token.');
    }
};

/**
 * Verifica un token JWT.
 * @param {string} token - El token JWT a verificar.
 * @returns {Promise<object>} Promesa que resuelve con el payload decodificado si es válido.
 * @throws {Error} Si el token es inválido, expirado o falta JWT_SECRET.
 */
export const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        if (!JWT_SECRET) {
            console.error("Error: JWT_SECRET no está definido.");
            return reject(new Error('Error de configuración del servidor.')); // No expongas detalles
        }
        if (!token) {
             return reject(new Error('No se proporcionó token.'));
        }

        jwt.verify(token, JWT_SECRET, (err, decodedPayload) => {
            if (err) {
                // Puedes loguear el error específico si quieres (err.name)
                console.error("Error al verificar token:", err.message); 
                // Devuelve un error genérico al cliente
                return reject(new Error('Token inválido o expirado')); 
            }
            resolve(decodedPayload); // Devuelve los datos del usuario si el token es válido
        });
    });
};