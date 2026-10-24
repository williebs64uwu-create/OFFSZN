# Correos, suscripciones y dashboard: análisis y faltantes

Revisado el 24/10/2026 con el buzón de Willie (solo lectura). No se guardan correos, enlaces personales ni direcciones de clientes.

## 1. Correos reales vs. el blueprint (v1.1)

### Lo que hace Vocal Essential en la práctica
| Capa | Qué es | Observación |
|---|---|---|
| Carrito abandonado | Flujo de 4 correos (E1–E4) + el correo nativo de Shopify "checkout abandonado" | Dos sistemas a la vez: el cliente puede recibir ambos |
| Carta personal "Eissa" | Texto plano, firmado por una persona, sobre el plan Pro | Sin enlace de baja visible |
| Winback | 13, 18 y 23 de octubre, con descuento que escala | Cadencia de ~5 días |
| Transaccional | Confirmación de pedido de Shopify, reseñas con Judge.me | Separado del marketing |

Contraste con el blueprint: el flujo real no respeta el "no enviar domingos" y mezcla voces de persona (marca / persona / Eissa). Lo útil del blueprint (tiempos del carrito, escalado de descuento, una sola voz) es lo que conviene copiar.

### Tu método actual (WI-D1…D4 + envíos manuales desde Gmail)
- Entre el 27/09 y hoy hay unos 200 correos enviados desde Gmail, casi todos "tenemos un plugin totalmente distinto" (Star Chain), uno a uno y en ráfagas.
- **Rebotes:** 8 hilos con "Delivery Status Failure" (550 5.1.1 = dirección inexistente) y 5 con retrasos/buzón lleno. Sigues insistiendo en esas direcciones.
- **Envío masivo con destinatarios visibles:** el 09/10 se mandaron 2 correos con 25 destinatarios cada uno en "Para". Todos ven las direcciones de los demás. Es lo más urgente de dejar de hacer.
- **Sin baja automática:** "responde BAJA" se procesa a mano. No hay lista de supresión.
- **Cupón y enlaces:** se anunciaba `VOCES` al 15% y enlaces de Payhip. Ahora `VOCES` = 20% en la tienda propia.
- **Sin seguimiento:** no sabes quién abrió, hizo clic o compró.

### Qué hace el sistema nuevo y cómo reemplaza eso
- Envío por Brevo, un correo por persona (nunca "Para" compartido).
- Baja con enlace firmado + lista de supresión (`unsubscribed`).
- Rebotes duros: pendiente de automatizar (ver faltantes).
- Flujos: carrito 2 h, lead 3 d, upsell 24 h, winback 45 d, seguimiento de prueba.

## 2. Pagos recurrentes con tarjeta (cómo lo hace Vocal Essential)
No pude abrir su sitio en esta sesión (proxy bloqueado), así que esto sale de sus correos y del estándar de Shopify. **Verificar en vivo antes de decidir.**
- El plan Pro (~19,99 USD/mes) se cobra con **planes de suscripción de Shopify** (selling plans) sobre tarjeta, y la cuenta del cliente (Hub / `/account`) gestiona la renovación y la cancelación.
- Los correos "Eissa" venden Pro con texto plano; no hay un sistema aparte de cobro.

### Tu opción: PayPal Business (manual)
1. Crear en PayPal **Suscripciones** (Productos y Planes): Basic 9 / Starter 19 / Pro 29, con prueba de 3 días.
2. El botón de PayPal en la tienda lleva al plan. Para activar acceso, hay dos caminos:
   - **Manual (hoy):** recibes el aviso, activas la membresía desde el CRM ("venta manual") y la etiqueta `MIEMBRO`.
   - **Automático (después):** webhook `BILLING.SUBSCRIPTION.*` → CRM. Requiere el ID de webhook de PayPal.
3. Renovación fallida o cancelación: PayPal avisa por webhook → tag `MIEMBRO-VENCIDO` + correo de recuperación.

## 3. Dashboard de referencia (Commas) vs. tu CRM

Qué tiene Commas y se vio en capturas: menú con Pagos; búsqueda con categorías; desplegable de estado con búsqueda; panel lateral "Añadir producto" con pestañas **único / recurrente**, interruptores avanzados (redirección posterior a la compra, order bump, upsells, cuota de alta, prueba gratis, prueba de pago, duración del plan, acceso al estudio) y "Crear y copiar enlace".

### Qué le falta a tu CRM
| Falta | Prioridad |
|---|---|
| Pantalla **Productos** (crear/editar con panel lateral, único vs. recurrente, "crear y copiar enlace") | Alta |
| Pantalla **Códigos de descuento** (hoy son constantes en código: `VOCES`, `WILLIE10`…) | Alta |
| Pantalla **Suscripciones** (estado, próximo cobro, cancelar, prueba) | Alta |
| Pantalla **Transacciones / pedidos** con reembolso manual | Media |
| **Order bump y upsell** configurables por producto | Media |
| Redirección posterior a la compra configurable | Media |
| **Lista de supresión por rebote duro** (automática) | Alta |
| Checklist de configuración ("termina de configurar": claves, dominio, correo) | Media |
| Búsqueda tipo ⌘K con categorías (ya existe la paleta, faltan categorías) | Baja |

## 4. Pack intermedio "Elige 5 presets"
Decisión de Willie: mismo concepto que el actual, con un intermedio estilo UAD donde el cliente elige, y se le regala uno extra al abrir la oferta (el preset gratis existente).
- Propuesta de precio (confirmar): base 15 USD / país alto 25 USD, con el regalo extra incluido.
- Implementación: ítem de carrito con `picks[]` guardados en servidor, validación (5 distintos, existentes), entrega de los 5 + 1 regalo.
