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
| `/owner/clientes-tienda` | `owner/clientes-tienda.html` | CRM básico: clientes con tags, export CSV, reporte A/B (clave owner) |

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
- Ofertas (validadas en servidor): bienvenida 50% (tope 10 USD, una por cuenta), 2x1 (el de menor precio gratis, el cliente elige entre iguales o menores), código de prueba vencida, cupones heredados (`WILLIE10`, `OFFSZN`, `SPECIAL`).
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

Migración: `server/migrations/20261022_willie_store.sql` (idempotente, RLS activo sin políticas: solo el backend).

- `store_customers` → tags: segmento (FREE / COMPRADOR V1 / V2), país, IP, VPN, compras, dinero, fuente, lead magnets, variante A/B, username, onboarding.
- `store_orders` → cada orden con líneas, oferta, región, token de entrega y licencias.
- `store_offers` → ofertas de un solo uso (bienvenida, prueba vencida), con `sent_at`, `clicked_at`, `used_at`.
- `store_trials` → pruebas de plugin con correo; `nudge_sent_at`, `followup_sent_at`, `converted_at`.
- `store_events` → embudo y A/B.
- `willie_orders` → entregas (se crea si no existe).

**Pendiente:** ejecutar la migración en Supabase (SQL Editor). Hasta entonces, las rutas nuevas responden error de BD, pero el checkout de PayPal sigue cobrando y entregando (los registros de tienda se loguean sin bloquear).

## 6. Automatización y CRM (hoja de ruta)

Hecho:
- Tags automáticos en cada lead, compra y prueba (segmento, país, VPN, dinero, horario tipo "13:34 PM · hace 2 días").
- Sincronización a Brevo con atributos (`SEGMENTO`, `PAIS`, `COMPRAS`, `TOTAL_GASTADO`, `ULTIMA_COMPRA`, `FUENTE`) si hay `BREVO_API_KEY` y `STORE_BREVO_LIST_ID`.
- Cron horario de seguimiento de pruebas.
- Aviso al owner en cada venta, resaltando lo que hay que entregar a mano.
- Panel de clientes con filtros y CSV; reporte A/B por variante.

Siguiente (para decidir juntos):
1. Secuencias de email (bienvenida, nutrición, carrito abandonado, post-compra) en Brevo con los mismos tags.
2. Carrito abandonado: evento `checkout_start` sin `purchase` a las 2 h.
3. Pipeline de ventas 1 a 1 por WhatsApp (estados: lead → prueba → cotizado → pagado), con seguimiento.
4. Dashboard de ingresos por país, fuente y campaña de Meta Ads (costo por venta real).
5. Afiliados y comisiones (ya existe la página `mi-perfil/ganar-comisiones`, sin construir).

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

## 8. Referencias de diseño (pendiente de acceso)

Intenté navegar `https://waveatmos.com` y `https://www.vocalessential.com`, pero el contenedor no puede abrir esos dominios (el proxy responde 403 y DNS no resuelve). Para revisarlos hay que agregar ambos hosts en **Network access → Allowed domains** de la configuración del entorno. Mientras tanto, el diseño está hecho a partir de lo que describiste (blanco texturizado, hero con reproductor antes/después, selector de artistas en avatares, escalera de valor y prueba en tu voz).

## 9. Pruebas y verificación

- `server/tests/store-pricing.test.mjs` (17 pruebas): región, VPN, VE/CU, 2x1 elige-tu-gratis, bienvenida con tope, código de prueba, cupón, total en soles, catálogo sin rutas expuestas. Ejecutar: `npm run test:store` dentro de `server/`.
- `npm run test:licensing` (existente) sin cambios de comportamiento.
- Smoke local: todas las páginas de la tienda responden 200; APIs de admin, cron y create-session rechazan sin clave.
- Navegador (Chromium, móvil y escritorio): sin errores de JavaScript ni desbordamiento horizontal en las 15 páginas auditadas; flujo añadir → 2x1 → checkout verificado.
