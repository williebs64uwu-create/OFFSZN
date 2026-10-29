# Tienda Willie Inspired · plan, arquitectura y pendientes

Ruta pública: `offszn.lat/willieinspired` · Rama: `ccr-ad55e05b-pqxmlz`

Este documento describe lo construido, cómo se conecta, lo que falta para ir a producción y la hoja de ruta del CRM/automatización.

---

## 1. Mapa de páginas

| URL | Plantilla | Qué hace |
|---|---|---|
| `/willieinspired` | `index.html` | Home: hero "Suena como [artista]" con antes/después, categorías, más vendidos, cómo funciona, 2x1, comunidad, FAQ, regalo |
| `/willieinspired/presets` · `/plantillas` · `/plugins` · `/servicios` | `tienda/coleccion.html` | Colección con filtros (artistas, packs, gratis, género), orden por precio, banner 2x1, bloque de cierre por colección |
| `/willieinspired/presets/artistas` | `coleccion.html` | Catálogo de artistas |
| `/willieinspired/presets/<slug>` · `/plugins/<slug>` · `/servicios/<slug>` · `/plugins/bundle/<slug>` | `tienda/producto.html` | Producto: galería (placeholders), precio por país, antes/después, "pruébalo en tu voz", prueba gratis de plugin, upsells, FAQ, barra fija en móvil |
| `/willieinspired/crea-tu-preset` · `crea-tu-plantilla` | `tienda/crea.html` | Captación del servicio a medida (prueba antes de pagar) |
| `/willieinspired/checkout` | `checkout.html` | Carrito completo: correo, 2x1 "elige tu gratis", cupón, PayPal, Yape (Perú), "otro método" por WhatsApp |
| `/willieinspired/oferta?lm=<slug>` | `tienda/oferta.html` | Gracias del regalo + video (se pausa a los 5 s) + popup A/B (50% bienvenida vs 2x1) |
| `/willieinspired/bienvenida` | `tienda/bienvenida.html` | Onboarding: cuenta → usuario y país → activa el 50% (uso único) |
| `/willieinspired/gracias` | `tienda/gracias.html` | Post-compra: archivos/licencias arriba, upsell abajo |
| `/willieinspired/mi-perfil` · `/mi-perfil/mis-compras` | `tienda/perfil.html` | Cuenta: tags (segmento, compras, dinero, país), compras y descargas |
| `/willieinspired/comunidad` · `/comunidad/suscribirse` | `tienda/comunidad.html` | Planes Basic 9 USD / Starter 19 / Pro 29 (3 días) |
| `/willieinspired/descargas?token=` | `descargas.html` (existente) | Portal de créditos de descarga (4 por producto) |
| `/crm` | `crm/index.html` | CRM con acceso por clave (ver sección 6). `/owner/clientes-tienda` redirige aquí |

Las rutas de la tienda se resuelven en `server/src/shared/store/pages.js` (una sola fuente), montadas en `server/src/app.js` antes de las páginas sueltas.

## 2. Embudo y recorridos

**Lead magnet (gratis):** landing del regalo → correo → video "cómo se usa" (se pausa a los 5 s) → popup A/B → producto o carrito.

**Compra:** producto → carrito (drawer) → checkout → pago (PayPal / Yape / otro) → entrega (archivos, licencias, correo) → gracias con upsell → comunidad.

**No compra (plugins):** prueba gratis de 3 días por correo (`store_trials`) → recordatorio a las 48 h si no activó → al vencer, oferta por país válida 72 h con código de un solo uso → clic en el correo se registra y lleva al producto con el precio aplicado.

**Upsell:** el producto define sus `upsells` en `store-catalog.json`. Preset → plantilla completa, con el género en un dropdown del checkout (`genres`) y video de "cómo suena".

## 3. Precios, país y VPN (`server/src/shared/store/pricing.js`)

- Niveles: **high** (5 → 10 USD) para AR, MX, US, DE, CL, DO; **base** (5 USD) para el resto. **VE y CU siempre base**, aunque la IP sea EE. UU. (pagan familiares).
- País efectivo = país de la cuenta (onboarding) > IP del CDN (`x-vercel-ip-country`) > zona horaria del navegador.
- **VPN:** si IP y zona horaria no coinciden se marca `vpn_suspected` y se cobra el **nivel más alto** de los dos: una VPN nunca baja el precio.
- Moneda local solo informativa (ARS, MXN, CLP, DOP, EUR); PEN para Yape en enteros de soles. El cobro siempre se calcula en el servidor.
- Ofertas (validadas en servidor): bienvenida 50% (tope 10 USD, una por cuenta), 2x1 (el de menor precio gratis, el cliente elige entre iguales o menores), código de prueba vencida, cupones heredados (`WILLIE10`, `OFFSZN`, `SPECIAL`) y `VOCES` (20%).
- Oferta de prueba vencida por país: premium (US, DE) 15 · high 10 · base 5 (**hipótesis inicial**, validar con las ventas reales).
- Tipos de cambio por env: `STORE_FX_ARS`, `STORE_FX_MXN`, `STORE_FX_EUR`, `STORE_FX_CLP`, `STORE_FX_DOP`, `YAPE_EXCHANGE_RATE_PEN`.

## 4. Backend (APIs)

Todas aisladas en sus propios archivos. Nada de lo nuevo reemplaza lo que ya usan otros productos: el checkout de Coca-Cola, Promo 2x1 y licencias sigue igual.

| Método y ruta | Auth | Función |
|---|---|---|
| `GET /api/store/catalog?tz=` | opcional | Catálogo + precio por región (sin rutas de archivos) |
| `GET /api/store/geo?tz=` | opcional | País, nivel y VPN |
| `POST /api/store/quote` | opcional | Total del carrito con oferta validada |
| `POST /api/store/leads` | pública (rate limit, honeypot, MX) | Lead magnet / avísame / comunidad → Brevo + correo |
| `POST /api/store/events` | opcional | Embudo y A/B (`popup_view`, `popup_click`, `add_to_cart`, `checkout_start`, `purchase`, `upsell_*`…) |
| `POST /api/store/trials` | pública | Prueba gratis de Easy Master / Easy Mix con correo |
| `GET /api/store/r/:code` | pública | Clic de oferta (registra `clicked_at`) |
| `POST /api/store/welcome/claim` | cuenta | Activa el 50% de bienvenida (una vez) |
| `GET /api/store/me` | cuenta | Perfil, tags, compras y descargas |
| `POST /api/store/onboarding` | cuenta | Usuario y país |
| `GET/POST /api/store/cron/trial-followups` | `Bearer STORE_CRON_SECRET` | Recordatorios y ofertas de prueba (cada hora, workflow de GitHub) |
| `GET /api/store/admin/customers` · `ab-report` | `x-admin-key` | CRM y A/B |
| `POST /api/willie/paypal/create` · `capture` | opcional | Checkout PayPal (total del servidor, items con SKU) |
| `POST /api/willie/yape/charge` | opcional | Yape vía Mercado Pago Perú |
| `GET /api/willie/delivery/:token` · `POST …/download` | token | Portal de descargas (4 créditos, URL firmada de 10 min) |
| `POST /api/willie/delivery/create-session` | **solo owner** (`x-admin-key`) | Entrega manual para ventas por WhatsApp |

**Seguridad corregida en este cambio**
- `create-session` era público: cualquiera podía crear descargas. Ahora requiere clave owner.
- Los precios nunca vienen del navegador: el servidor recalcula desde el catálogo y, en la captura de PayPal, lee la orden guardada en PayPal (SKU + `custom_id`).
- La demo del portal ya no entrega archivos reales.
- Los créditos se descuentan solo cuando la URL firmada se generó bien.
- Entregas persistidas en Supabase (`willie_orders`); la memoria solo cachea por instancia.
- Rate limit en pagos (40 / 10 min) y en formularios.
- Correos validados con el mismo validador de la lista de espera, que ahora es compartido.
- Lecturas de email exactas (sin comodines de `ilike`).

## 5. Base de datos

Migraciones (correr en este orden en Supabase → SQL Editor; idempotentes, RLS sin políticas: solo el backend):
1. `server/migrations/20261022_willie_store.sql`
2. `server/migrations/20261023_willie_crm.sql` (carritos, pipeline, notas, reglas y registro de automatizaciones, baja de correos)

- `store_customers` → tags: segmento (FREE / COMPRADOR V1 / V2), país, IP, VPN, compras, dinero, fuente, lead magnets, variante A/B, username, onboarding.
- `store_orders` → cada orden con líneas, oferta, región, token de entrega y licencias.
- `store_offers` → ofertas de un solo uso (bienvenida, prueba vencida), con `sent_at`, `clicked_at`, `used_at`.
- `store_trials` → pruebas de plugin con correo; `nudge_sent_at`, `followup_sent_at`, `converted_at`.
- `store_events` → embudo y A/B.
- `willie_orders` → entregas (se crea si no existe).
- CRM: `store_carts`, `store_deals`, `store_notes`, `store_automation_rules`, `store_automation_log` (+ columnas `tags`, `unsubscribed`, `whatsapp` en clientes).

**Pendiente:** ejecutar la migración en Supabase (SQL Editor). Hasta entonces, las rutas nuevas responden error de BD, pero el checkout de PayPal sigue cobrando y entregando (los registros de tienda se loguean sin bloquear).

## 6. CRM propio (estilo HighLevel, a la medida de tu nicho)

Panel: **`offszn.lat/crm`**. Diseño con la estructura de HighLevel (barra lateral oscura, pipeline, automatizaciones) y componentes al estilo shadcn/ui (tokens zinc, tarjetas, badges, tablas, panel lateral, diálogos, paleta ⌘K, tema claro/oscuro), hecho en CSS puro para no depender de un build. Todo vive en tu base y en tu servidor, sin pagar otra herramienta.

**Acceso:** pantalla de clave. Hay **una sola clave para todos los paneles** (CRM, licencias, pagos manuales, lista de espera, notas, diagnóstico, logs): la variable de entorno `OFFSZN_VARIABLE_PANEL`. Ya no existen claves escritas en el código; si la variable no está definida, nadie entra. Si en el servidor sigue la variable antigua `PLUGIN_ADMIN_KEY`, bórrala: mientras exista cuenta como una segunda clave (el CRM lo avisa en *Estado del sistema*). Se verifica en el servidor, bloquea 15 minutos tras 8 intentos fallidos y la clave se guarda solo en esta sesión del navegador, o en el dispositivo si marcas "Recordar".

**Archivos:** `crm/index.html` (estructura), `crm/crm.css` (sistema de diseño), `crm/js/core.js` (acceso, router, panel lateral, diálogos, búsqueda) y `crm/js/pages.js` (cada pantalla).

| Pestaña | Qué hace |
|---|---|
| **Resumen** | Ingresos, ventas, ticket medio, recompra, embudo por sesiones (visitan → carrito → checkout → compran), ingresos por país / fuente (utm) / método, productos más vendidos, uso de ofertas, pruebas → compra, carritos recuperados y tareas pendientes |
| **Contactos** | Búsqueda y filtros (segmento, país, etiqueta), CSV. Al abrir uno: segmento, país y VPN, etiquetas propias, WhatsApp, notas y tareas con fecha, y **línea de tiempo** (lo que vio, añadió al carrito, compró, pruebas y correos automáticos que recibió) |
| **Pipeline** | Lead → Prueba → Cotizado → Pagado → Perdido. Se crea y avanza solo (regalo o "avísame" = lead, prueba de plugin = prueba, pago = pagado) y también a mano para tus ventas 1 a 1 por WhatsApp |
| **Automatizaciones** | Prender/pausar cada una, ver cuántos correos salieron en 30 días y ejecutar ahora |
| **Venta manual** | Registras una venta cerrada por WhatsApp (productos, país, precio acordado): entrega archivos y licencias, manda el correo y queda en el CRM y en Meta como cualquier compra |
| **Experimentos** | 50% de bienvenida vs 2x1: vistas, clics, leads, compras e ingreso por variante, y quién va ganando (con mínimo de 30 vistas) |
| **Tareas** | Lo pendiente de todos tus contactos, agrupado en vencidas, hoy y próximas |
| **Estado del sistema** | Qué está conectado (Brevo, PayPal, Yape, Meta, R2), qué tablas faltan correr en Supabase y qué portadas, audios y videos faltan subir |

**Automatizaciones activas** (cada hora; cada persona recibe cada correo una sola vez, con enlace de baja firmado):
1. Carrito abandonado a las 2 h (si dejó su correo en el checkout), con enlace que recupera el carrito.
2. Lead que pidió un regalo y no compró en 3 días, con su oferta de bienvenida.
3. Upsell a las 24 h de una compra, según la escalera de valor del producto.
4. Recompra a los 45 días, con 2x1.
5. Pruebas de plugin: recordatorio a las 48 h sin activar y oferta por país al vencer.

**Tracking:** Meta Pixel y Conversions API con `event_id` común (compra deduplicada), `_fbp`/`_fbc`, UTM guardadas en cada orden, tags automáticos (segmento, país, VPN, dinero, horario "13:34 PM · hace 2 días") y sincronización a Brevo.

**Para después (con IA, cuando quieras):** respuesta sugerida a comentarios y WhatsApp, resumen de la conversación de cada lead, texto de correos por segmento, detección de qué video/CTA convierte, y puntaje de probabilidad de compra.

**Más adelante sin IA:** secuencias de varios pasos editables desde el panel, afiliados y comisiones (`mi-perfil/ganar-comisiones`), y costo por venta real cruzando el gasto de Meta Ads.

## 7. Qué falta para publicar (acción tuya)

**Imágenes, videos y audios** (placeholders con el nombre visible en cada lugar):
- Portadas faltantes (16 presets de artistas sin archivo real): `cero, conep, d4vd, easykid, gloosito, latin-mafia, lolo, ober, remers, skisia2, slime-santi, strangehuman, suei, torres, torrres, turde`. Mientras falten, la tarjeta muestra un placeholder con el nombre.
- Audios antes/después: 53 artistas sin demo. Solo tienen audio Alejo, Yan Block, Omar Courtz y Yeyo (campo `artistAudio` en `store-catalog.json`).
- Portadas de plugins, plantillas y servicios: 45 de 91 productos sin `media.cover` en total (incluye los que no tienen imagen aún).
- Videos "cómo se usa" por producto (`media.video` en `store-catalog.json`), video de la home, de la comunidad y de Easy Master.
- Capturas de testimonios (4 en la home) y del feed de comunidad.
- Imagen del regalo gratis (`media.cover` del lead magnet).

**Archivos en R2 (cuando los subas):** los presets usan `bucket_key` de `artist-presets-catalog.json`. Para los nuevos, agregar `files` en `store-catalog.json` con la misma forma. Los links del regalo gratis (`media.download`) también son de R2.

**Variables de entorno** (Render / Vercel):
- `STORE_CRON_SECRET` (y el mismo secret en GitHub Actions `STORE_CRON_SECRET`).
- `STORE_BREVO_LIST_ID` (opcional), `STORE_WELCOME_MAX_USD` (opcional, 10).
- Tipos de cambio opcionales (ver sección 3).

**Verificaciones externas que aún no pude hacer:**
- PayPal y Yape en sandbox/producción: el código está probado solo en pruebas unitarias de precios y en el flujo de navegador hasta el checkout.
- Envío real de correos (Brevo) y creación de licencias contra la base real.
- Migración SQL aplicada.

## 8. Referencias de diseño

Análisis comparado de The Vox Box, Vocal Essential y WaveAtmos, con veredicto y estructura propuesta: ver `docs/willieinspired-tienda/DISENO-REFERENCIAS.md`.

## 9. Pruebas y verificación

- `server/tests/store-pricing.test.mjs` (17 pruebas; más 9 de automatizaciones y CRM): región, VPN, VE/CU, 2x1 elige-tu-gratis, bienvenida con tope, código de prueba, cupón, total en soles, catálogo sin rutas expuestas. Ejecutar: `npm run test:store` dentro de `server/` (incluye reglas de automatización, resumen del dashboard y el motor de envío contra una base falsa: no repite correos, respeta bajas y pausas, reintenta si falla).
- `npm run test:licensing` (existente) sin cambios de comportamiento.
- Smoke local: todas las páginas de la tienda responden 200; APIs de admin, cron y create-session rechazan sin clave.
- Navegador (Chromium, móvil y escritorio): sin errores de JavaScript ni desbordamiento horizontal en las 15 páginas auditadas; flujo añadir → 2x1 → checkout verificado.
