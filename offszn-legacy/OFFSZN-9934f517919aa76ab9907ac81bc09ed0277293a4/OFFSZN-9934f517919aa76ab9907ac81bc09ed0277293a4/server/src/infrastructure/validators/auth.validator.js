import { z } from 'zod';

// Esquema para registro de usuario
export const registerSchema = z.object({
    email: z.string({
        required_error: "El email es requerido",
        invalid_type_error: "El email debe ser un texto"
    })
        .email("El formato del email es inválido")
        .max(255, "El email excede la longitud máxima (255)"),

    password: z.string({
        required_error: "La contraseña es requerida",
    })
        .min(6, "La contraseña debe tener al menos 6 caracteres")
        .max(128, "La contraseña es demasiado larga"),

    // Si tuviéramos un campo adicional como nombre, se agrega aquí.
    // Zod .strict() asegura que la solicitud falle si alguien inyecta campos como `role: "admin"`
}).strict("No se permiten campos adicionales (Posible intento de inyección de parámetros).");

// Esquema para login de usuario (suele ser similar, pero con distintos mensajes si se desea)
export const loginSchema = z.object({
    email: z.string({
        required_error: "El email es requerido",
    }).email("El formato del email es inválido")
        .max(255, "El email max. es 255"),

    password: z.string({
        required_error: "La contraseña es requerida",
    }).min(1, "La contraseña no puede estar vacía")
        .max(128, "La contraseña es demasiado larga"),

}).strict();

// Esquema para validar disponibilidad de email
export const checkEmailSchema = z.object({
    email: z.string({
        required_error: "El email es requerido",
    }).email("Por favor inserta un email válido")
        .max(255)
}).strict();

// Esquema para comprobar si existe nickname
// (El controlador original espera 'nickname')
export const checkNicknameSchema = z.object({
    nickname: z.string({
        required_error: "El nickname es requerido",
    }).min(3, "Mínimo 3 caracteres")
        .max(50, "Máximo 50 caracteres")
        // Sin espacios (RegEx)
        .regex(/^\S+$/, "No se permiten espacios en el nickname"),
}).strict();
