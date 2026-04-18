# Arquitectura de Membresías y Ecosistema VIP en OFFSZN

Este documento establece las bases y la visión a futuro para centralizar cobros, donaciones y accesos VIP (estilo Patreon/OnlyFans para productores) directamente en OFFSZN, eliminando la dependencia de Payhip.

## 1. Visión y Centralización (Modelo Creadores)
El objetivo es transformar OFFSZN en una plataforma dinámica para creadores.
*   **Rutas Dinámicas:** Cada creador tendrá su espacio VIP cerrado tipo `offszn.lat/vip/[nickname-usuario]`.
*   **Feed de Contenido:** En esta URL, el creador publicará "Posts" que servirán como actualizaciones ("Próximamente", "Nuevo Preset", videos explicativos).
*   **Donaciones y Suscripciones (Self-Hosted):** Como Stripe no opera localmente en Perú, la pasarela a integrar nativamente será la **API de PayPal (Checkout y Subscriptions)**, procesando todo dentro de la web sin sacar al usuario.

## 2. Estrategia a Corto Plazo (Validación del Mercado)
Antes de invertir semanas codificando pasarelas complejas:
1. Usamos Payhip como validador vendiendo un ticket de "Acceso VIP OFFSZN" (Lifetime o Anual).
2. El usuario redime ese acceso en OFFSZN y se le activa el rol VIP.
3. Esto permite confirmar qué tanto desea la audiencia pagar por el "Paquete Completo" antes de codificar The Creator Economy en OFFSZN.

## 3. Seguridad Híbrida y Tracking de Enlaces (Anti-Trampa)
Aceptamos que si alguien descarga el ZIP y se lo manda por drive a un amigo, no podemos frenarlo físicamente. Pero **sí blindaremos el sistema contra raspadores (scrapers) y personas que compartan URLs**.

### El Flujo "Burn on Share"
1. El usuario validado (VIP) entra a ver un post exclusivo del preset.
2. Da clic al botón de Descargar.
3. Es enviado a una Landing única y dinámica de descarga real (Ej. `offszn.lat/download/token-seguro`).
4. **Alarma y Tracking:** Si el usuario copia ESE enlace de la landing y lo manda a un grupo de WhatsApp, en cuanto una IP no autorizada sin sesión activa intente entrar, la BD registra un intento de intrusión asociado al token de ese usuario. Podemos implementar "Strikes" y eventual baneo automático por fugas de links abusivas.

## 4. Rate Limiting Refinado (Límites por Producto)
Para no perjudicar la experiencia general ni parecer limitados:
*   **Por Producto, no Persistente:** Un cliente tiene derecho a un máximo de **5 descargas por día por CADA preset**.
*   **Regeneración:** Al día siguiente, vuelve a estar en `5/5`.
*   Esto asegura que el usuario real pueda volver a descargar si formató su PC o canceló por error, pero hace imposible que un script extraiga masivamente ancho de banda o todos los archivos en 1 hora.
