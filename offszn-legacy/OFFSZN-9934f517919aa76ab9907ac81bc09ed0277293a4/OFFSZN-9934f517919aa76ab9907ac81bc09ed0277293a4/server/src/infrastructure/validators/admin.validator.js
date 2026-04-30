import { z } from 'zod';

// Esquema para la creación y actualización de productos
export const productSchema = z.object({
    name: z.string({
        required_error: "El nombre es requerido",
    }).min(2, "El nombre debe tener al menos 2 caracteres")
        .max(150, "El nombre es demasiado largo"),

    description: z.string({
        required_error: "La descripción es requerida",
    }).min(10, "La descripción debe tener al menos 10 caracteres")
        .max(5000, "La descripción es demasiado larga"),

    price: z.preprocess(
        (val) => Number(val),
        z.number({ required_error: "El precio es requerido" })
            .min(0, "El precio no puede ser negativo")
            .max(100000, "El precio excede el límite permitido")
    ),

    image_url: z.string({
        required_error: "La URL de la imagen es requerida",
    }).url("Debe ser una URL válida"),

    download_url: z.string({
        required_error: "La URL de descarga es requerida",
    }).url("Debe ser una URL válida"),

    // Agregamos otros campos que el controlador pueda ignorar pero supabase acepte
    // Y bloqueamos estricto para evitar `role`, `is_admin`, etc.
}).strict();

// Esquema genérico para parámetros de ID (Ej. /products/:id)
// Útil si el ID es un UUID, aunque supongo que es un uuid de Supabase o string.
export const paramIdSchema = z.object({
    id: z.string({
        required_error: "El ID es requerido",
    }).min(1, "El ID no puede estar vacío")
}).strict();
