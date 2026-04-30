import { z } from 'zod';

// Middleware genérico para validar peticiones usando schemas de Zod.
// Se puede configurar para que valide body, query, param, etc.
// Por defecto, valida req.body.
export const validateRequest = (schema, property = 'body') => {
    return (req, res, next) => {
        try {
            // Intenta parchear con Zod
            const parsedData = schema.parse(req[property]);

            // Reemplaza el objeto por la versión sanitaria ("parseada"). 
            // Zod 'strict()' ya habrá bloqueado campos raros, o los habrá eliminado (si no es 'strict'). 
            // Esto previene NoSQL Injection / Pollution via parámetros raros inyectables.
            req[property] = parsedData;

            // Continua el middleware si todo esta correcto
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Formateando errores amigables para el usuario
                const errorMessages = error.errors.map((err) => ({
                    field: err.path.join('.'),
                    error: err.message
                }));

                console.warn(`[Zod Validation Failed] en ${req.method} ${req.originalUrl}`);

                // Retorna 400 Bad Request
                return res.status(400).json({
                    error: 'Los datos proporcionados no son válidos.',
                    details: errorMessages
                });
            }
            next(error);
        }
    };
};
