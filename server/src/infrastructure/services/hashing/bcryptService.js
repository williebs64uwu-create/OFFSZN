import bcrypt from 'bcrypt';

const saltRounds = 10;

/**
 * Hashea una contraseña en texto plano.
 * @param {string} plainPassword - La contraseña a hashear.
 * @returns {Promise<string>} Promesa que resuelve con el hash de la contraseña.
 */
export const hashPassword = async (plainPassword) => {
    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);
        return hashedPassword;
    } catch (error) {
        console.error("Error al hashear contraseña:", error);
        throw new Error("Error interno al procesar la contraseña.");
    }
};

/**
 * Compara una contraseña en texto plano con un hash guardado.
 * @param {string} plainPassword - La contraseña enviada por el usuario.
 * @param {string} hashedPassword - El hash guardado en la base de datos.
 * @returns {Promise<boolean>} Promesa que resuelve a true si coinciden, false si no.
 */
export const comparePassword = async (plainPassword, hashedPassword) => {
    try {
        const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
        return isMatch;
    } catch (error) {
        console.error("Error al comparar contraseñas:", error);
        return false; 
    }
};