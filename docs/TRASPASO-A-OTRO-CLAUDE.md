# Traspaso a otro Claude — tienda de Willie Inspired (1 nov 2026)

Lee esto completo antes de tocar nada. Complementa a `docs/CONTEXTO-SESION.md` (finanzas, STAR CHAIN, PayPal, reglas del dinero). Aquí está lo que se hizo en la sesión del 31 oct → 1 nov 2026 sobre la **tienda de Willie** (presets, carrito, checkout, buscador, landing), con el porqué de cada decisión.

## 0. Quién es Willie y cómo trabajar con él
- Willie (marca OFFSZN, tienda "Willie Inspired", offszn.lat). Productor de FL Studio; vende presets, plantillas, plugins de audio y servicios. Escribe en español informal ("bro").
- Responde en **español simple y natural**, primero lo importante. Le gusta ver cada cambio en **localhost** y decir si le gusta o no. Pide mucho "revisarlo" y "hacerlo mejor"; da imágenes de referencia (Shopify, VoxBox, Cloudflare, vocalessential) para inspirarse en **patrones**, no para copiar textos, imágenes ni marca.
- **Nada inventado:** si un dato no existe se marca "sin dato" y se pregunta. Verificar de verdad y decir con honestidad lo que NO se probó.
- Reglas fijas (ver también `C:\Users\Willie\.claude\CLAUDE.md`):
  - **Push / GitHub Actions / deploys: solo si Willie lo pide explícitamente.** Commits locales sí. (Hoy pidió subir a `main` y se subió; para lo nuevo vuelve a preguntar.)
  - Nunca borrar archivos de Willie. Sin claves en código ni repos.
  - En lo que dice la interfaz/bot: "tu DAW" (nunca "FL"), "S" (nunca "eses"). Nada debe parpadear.
  - Backend `D:\!OFFSZN\PROYECTOS\OFFSZN`: no tocar `owner/licencias_plugins_offszn.md`, `metodo/`, `entregables/`, `images/manual-plugins/`, `server/send_trial_to_user.js`.
  - Repo: `williebs64uwu-create/OFFSZN`, rama `main`. Local: `D:\!OFFSZN\PROYECTOS\OFFSZN`.
- Memorias y notas en su PC: `C:\Users\Willie\Desktop\_CLAUDE Y KIT\CLAUDE\08_DONDE_NOS_QUEDAMOS.md` (ya tiene una sección del 1 nov) y `00_LEEME_PRIMERO.md`.

## 1. Cómo levantar y probar
```bash
git pull origin main
npm install
npm run dev            # http://localhost:3000   (node --watch server/src/app.js)
cd server && npm run test:store   # precios, catálogo, CRM, ventas, finanzas
cd server && npm run test:star    # STAR, yape, finanzas, ruta de preset
```
- **Dos pruebas fallan y NO son de esta sesión:** `admin-key › sin variable de entorno nadie entra` (porque `server/.env` ya trae la clave del panel) y `finance-service › pesos argentinos: el depósito...` (usa el mes '2026-10' fijo y hoy ya es noviembre).
- `server/.env` apunta a la Supabase REAL (`qtjpvztpgfymjhhpoouq`): lo que se guarde desde localhost cae en datos reales. En mis pruebas se mandaron algunos clics de prueba (Yape/Binance, ref como `E9CGN`) a `manual_payment_clicks`: son de prueba, se pueden borrar en el panel/BD con permiso de Willie.

## 2. Estado de `main` (todo subido, HEAD `6f37416`)
Commits de esta sesión (de antiguo a nuevo):
1. `6d2c572` ruta `/presets/<artista>` + descuento por cantidad + hover "Todo ya viene ajustado"
2. `5a29192` carrito lateral y nombre Willie Inspired en preset
3. `ac8d670` / `5bd1164` / `6011c86` / `76a8a75` checkout Shopify → simplificado → limpio → métodos en recuadros
4. `3b4dd4f` ventanas de Yape y Binance, Mercado Pago en ARS, clics al panel de pagos manuales
5. `da6acd3` mensaje de WhatsApp sin "Ref"
6. `e1cc721` cupones con aviso, montos "USD $154.80", Yape alineado con Easy Mix
7. `548d849` buscador tipo paleta de comandos
8. `082ce57` preset con menú/pie modulares
9. `a6ba12c` landing con diseño de artistas + "Elige tu regalo"
10. `6f37416` ruta oficial `/willieinspired/presets/<artista>`, buscador tolerante, notas

## 3. Mapa de la tienda (lo que existe y dónde)
- **Páginas de la tienda** (`willieinspired/`): `index.html` (landing), `checkout.html`, `tienda/*.html` (colección, producto genérico, perfil, comunidad, gracias…). Rutas en `server/src/shared/store/pages.js` y `server/src/app.js`.
- **Runtime modular:** `willieinspired/assets/store.js` + `store.css`. Pone el **menú, carrito lateral (drawer), buscador y pie** con `WI.init()/WI.layout()`. **Es el nav/footer modular que Willie quiere usar SIEMPRE.** Carrito en `localStorage` clave `wi_cart` (solo ids; el precio lo pone el servidor). Oferta activa en `wi_offer`.
- **Página de preset de artista:** `preset.html` + `css/preset-page.css` (todo dentro de `.pp`, variables `--pp-*` para no chocar con store.css) + `script/preset-page.js`. El servidor inyecta los datos en `<script id="presetData">` (función `serveProductPage` y `storePresetAsPage` en `server/src/app.js`). Tema claro fijo con `<html data-theme-lock="light">`.
- **Landing `/willieinspired`:** el hero reutiliza el markup de la página de preset (`window.PP_LANDING = true`); `PP.switchTo(slug)` cambia de artista **sin recargar** pidiendo `/willieinspired/presets/<slug>` y leyendo su JSON. Sección "Elige tu regalo" (`#gratis`): preset gratis / prueba Easy Master 3 días / plantilla gratis.
- **Catálogo y precios (servidor):** `server/src/shared/store/catalog.js` (une `willieinspired/data/store-catalog.json` + `artist-presets-catalog.json`) y `pricing.js` (región, nivel de precio, `quoteCart`). Cobros: `server/src/infrastructure/http/controllers/WillieCheckoutController.js` (PayPal + Yape), entrega en `WilliePresetDeliveryController.js`, API pública en `StoreController.js` (`/api/store/catalog`, `/quote`, `/cart`…), lógica en `services/storeService.js`.
- **Panel de pagos manuales:** `/owner/pagos-manuales`; recibe clics por `POST /api/plugin/payment-click` (`PaymentClickController.js`, tabla `manual_payment_clicks`).
- **Marketplace (otro sistema, NO tocar):** `/preset/<slug>`, `/carrito`, `/pages/checkout.html`, `script/cart.js`. Willie quiere que los presets de la tienda NO se confundan con el marketplace.

## 4. URLs oficiales
- Preset de artista: **`/willieinspired/presets/<artista>`** (ej. `remers`, `bad-bunny`). Redirigen a ahí: `/presets/<x>` (302, quita `preset-de-`) y `/willieinspired/presets/artistas/<x>` (301). `WI.url()` ya genera la ruta nueva.
- Si el slug no es un artista de `artist-presets-catalog.json`, sigue la página genérica de la tienda.
- `/willieinspired/presets`, `/plantillas`, `/plugins`, `/servicios`, `/checkout`, `/mi-perfil/…`.

## 5. Reglas de negocio ya implementadas
- **Precios por país** (pricing.js): base US$5 / alto US$10 según IP+zona horaria; VE/CU siempre base; VPN sospechosa cobra el nivel más alto. Se **muestra en dólares** (Willie lo pidió); en Perú Yape cobra en **soles** (`YAPE_EXCHANGE_RATE_PEN`, defecto 3.3, soles enteros).
- **Pesos argentinos:** **1 USD = 1500 ARS** (default de `STORE_FX_ARS`, editable por variable de entorno). El total en ARS se calcula en el servidor (`totalArs`) y se muestra solo en la fila de Mercado Pago (formato `ARS 52.500`).
- **Descuento por cantidad (solo presets de artistas, `eligibleVolume`):** 2 → 10 %, 3 → 20 %, 4 o más → 25 % (equivale a 1 de cada 4 gratis cuando valen igual). Lo calcula SIEMPRE el servidor. No se acumula con otras ofertas; **contra un cupón gana el que más ahorra** y el checkout lo explica. Las ventas manuales del CRM lo apagan (`autoVolume:false`).
- **Cupones de la tienda** (`LEGACY_COUPONS` en pricing.js): `WILLIE10` 10 %, `VOCES` 20 %, `SPECIAL` 15 %, `OFFSZN` US$5 fijos. Un cupón inexistente ahora devuelve "Ese cupón no existe." y no deja pagar hasta quitarlo. (Los cupones de STAR CHAIN `OFFSZN/STAR/WILLIE/GODMIXING` son otro sistema, en `plugins/checkout.html`.)
- **Yape (tienda):** ventana modal parecida a la de Easy Mix (`script/yape-checkout.js` es la de plugins; la de la tienda está dentro de `checkout.html`). Cobra con `/api/willie/yape/charge`. Los items mandados a Mercado Pago llevan descripción y **suman exacto** el monto (`yapeItems()` en `WillieCheckoutController.js`).
- **Mercado Pago y Binance son manuales:** abren WhatsApp con "Hola, quiero comprar "X" por Mercado Pago/Binance" (sin precio ni ref) y **el clic se registra** en el panel de pagos manuales (producto, método, precio USD/PEN). Binance abre ventana con el perfil de Willie (`images/payments/binance-perfil.png`, ID **1257117526**), copiar ID y botón "Ya pagué · avisar a Willie".
- **Checkout `/willieinspired/checkout`** (estilo Shopify, fondo gris a la derecha): nota corta de descarga, Contacto (correo + "Iniciar sesión"), botones PayPal/tarjeta, recuadros Yape / Mercado Pago / Binance con logo y precio, resumen con miniaturas grandes, cupón visible (etiqueta + botón negro "Aplicar"), "USD $x.xx". **Ningún método viene seleccionado.** Sin avisos extra ni cajas de "entrega/soporte".
- **Buscador del menú** (`WI.search` en store.js): lupa (también Ctrl+K sin anunciarlo). Muestra Recientes + Recomendados; al escribir agrupa por Presets/Plantillas/Plugins/Servicios; **tolera tildes, mayúsculas, errores de tipeo (distancia de edición) y nombres pegados** ("badbunny", "omar curtz", "remmers"). Sin atajos ni teclas visibles; X para cerrar.
- **Carrito lateral de la tienda:** muestra barra de avance del descuento y "Completa tu descuento" con presets sugeridos; importes en dólares.

## 6. Decisiones de diseño de Willie (no las deshagas sin preguntar)
- Usar siempre el **nav/footer modular** de la tienda (`store.js`).
- Checkout: simple, de confianza, nada que distraiga; sin facturación; Stripe/Shopify como referencia. "Pago rápido", "O paga con…", "Otro método de pago: escríbele a Willie" → **quitados** a petición.
- Nombre de marca en cabeceras: **"Willie Inspired"** (no el logo OFFSZN).
- Mensaje de WhatsApp: corto, **sin "Ref"** (el clic ya queda en el panel).
- Imágenes de "Todo ya viene ajustado" deben ser **capturas propias** de Willie, no de otras tiendas.
- Packs/bundles: **después** (ver ideas). Primero el descuento por cantidad.

## 7. Pendientes y cosas que NO se han probado
1. **Cobros reales:** ni PayPal ni Yape se han probado con dinero real. Probar con un preset de US$5 (≈ S/17) y verificar panel, correo y entrega. Las pruebas del CONTEXTO-SESION.md (STAR CHAIN, cuota, despacho) siguen pendientes.
2. **QR de Binance:** NO existe. No se inventó el formato. Willie debe guardar la captura de su QR de Binance Pay en `images/payments/binance-qr.png` (la ventana ya la muestra sola cuando existe).
3. **Audios antes/después:** casi ningún artista los tiene (solo ~7 de 39 con audio RAW distinto). Esos muestran "Sin audio de muestra". Remers toma portada/audio del marketplace (`preset-de-remers`) porque la tienda no los tiene.
4. **Capturas propias** para la sección "Todo ya viene ajustado" en `images/preset-como-funciona/` (`eq.webp`, `compresion.webp`, `delay.webp`, `reverb.webp`, `ganancia.webp`); hoy hay íconos.
5. **Tarjeta (PayPal):** el formulario con dirección/nombre/móvil lo pone PayPal y no se puede achicar; "Desarrollado por PayPal" tampoco se puede ocultar mientras exista el botón de tarjeta. Opciones dadas a Willie: dejarlo (recomendado), quitar el botón de tarjeta, o pasar a Stripe (proyecto aparte). **No eligió todavía.**
6. Páginas de **plantillas / plugins / servicios** y la colección aún usan el diseño anterior; Willie quiere extender el diseño nuevo a la tienda y el resto.
7. Quitar `noindex` de `preset.html` cuando Willie apruebe (hoy tiene `noindex, follow`).
8. Revisar precios cuando las páginas estén listas y **unificar el catálogo** (IDs y precios repetidos en ~6 archivos: pluginRegistry.js, yapePricing.js, YapeController.js, PayPalController.js, plugin-checkout.js, páginas).
9. El precio tachado ("antes") de la tienda viene de `compareAt` (precio de lista más alto): en el checkout nuevo solo se tacha cuando hay un descuento real; en las tarjetas de la tienda puede seguir saliendo. Preguntar a Willie si lo quita.
10. Panel de pagos manuales: el total en pesos argentinos **no** se guarda (esa tabla solo tiene USD y PEN).
11. Mobile: se revisó la landing y la página de preset; **no** se revisó a fondo el checkout en celular.
12. Probar el envío real de los formularios de "Elige tu regalo" (preset gratis, plantilla, prueba de plugin).

## 8. Ideas conversadas (sin hacer)
- **Packs y bundles** estilo UAD / "packs de picks": Willie quiere definir bien la estructura antes (qué incluye, cómo se paga). Hoy solo existen `bundle-todos-los-presets` y `bundle-promo-2x1`.
- **A/B del checkout:** botones tipo STAR CHAIN (`plugins/checkout.html`) vs un solo método estilo Stripe, para ver cuál convierte más.
- Reembolsos/disputas, revisión diaria contra PayPal, backups diarios de Supabase, régimen tributario a S/10 mil mensuales, Mercado Pago automático para Argentina (hoy manual).
- Página de "cosas gratis" más completa (estilo videojuego de la referencia TVB: Willie mostró el estilo; se hizo una versión limpia, no pixel-art).
- Buscador: ordenar "Recomendados" por ventas reales cuando haya datos por artista (hoy es una lista fija en `SEARCH_RECOMMENDED`).

## 9. Trampas técnicas que ya costaron tiempo
- **Caché del navegador:** `store.js`, `store.css` y `preset-page.js/css` se piden con `?v=N`. **Sube el número en TODAS las páginas** que los cargan cada vez que los cambies (`preset.html`, `willieinspired/index.html`, `checkout.html`, `scratch-card-demo.html`, `tienda/*.html`); si no, el navegador usa una copia vieja y salen errores como `WI.volumeHint is not a function`. Versiones actuales: `store.js?v=14`, `store.css?v=5`, `preset-page.js?v=11`, `preset-page.css?v=5`.
- **Windows CRLF:** varios archivos usan CRLF; los reemplazos de texto de varias líneas fallan si no se normaliza. Al editar con scripts, convierte `\r\n`→`\n` y vuelve a CRLF al guardar (git avisa "LF will be replaced by CRLF": es normal).
- **`String.replace` con `$$`:** en JavaScript `$$` en el texto de reemplazo se convierte en `$`; usa `split().join()` para no romper `WI.$$`.
- **PayPal pinta sus botones en iframes con z-index alto:** las ventanas modales del checkout usan `z-index:2147483000` y ocultan `#paypalButtons` mientras están abiertas.
- **Dos hojas con las mismas variables CSS** (`--bg`, `--ink`, `--radius`): por eso `preset-page.css` está dentro de `.pp` con `--pp-*`.
- **Temas:** la tienda sigue el tema claro/oscuro del usuario; la página de preset fuerza claro con `data-theme-lock`; el hero de la landing tiene su propio fondo claro dentro de un `.pp--landing`.
- `serveProductPage` en `app.js` es una función hoisted que atiende tanto `/preset/:slug` (marketplace, `?v=2` = vista previa) como `/willieinspired/presets/:slug`.
- Binance, Yape y el panel: **no confundir** `script/yape-checkout.js` (plugins, cobra por `/api/orders/yape/charge`) con el Yape de la tienda (`/api/willie/yape/charge`).
- La landing llama a `WI.init()` por su cuenta; `preset-page.js` en modo landing NO vuelve a llamarla (si lo hiciera, el menú se duplicaría).

## 10. Prompt para pegar en el otro Claude
> Lee `docs/TRASPASO-A-OTRO-CLAUDE.md` completo y luego `docs/CONTEXTO-SESION.md`. Respeta las reglas: todo se revisa primero en localhost; **no hagas push, deploy ni cambios de dinero sin que yo lo pida**; nada inventado; español simple. Corre `git pull origin main`, `npm install` y `npm run dev`, y déjame abrir `http://localhost:3000/willieinspired` y `http://localhost:3000/willieinspired/presets/remers`. Cuando termines de leer, resúmeme en 10 líneas qué entendiste, qué falta (sección 7) y qué sigue, para que yo corrija lo que falte.
