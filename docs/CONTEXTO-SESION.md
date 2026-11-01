# Contexto de la sesión (traspaso a una sesión local)

Resumen de lo construido y decidido con Willie hasta el 1 de noviembre de 2026. Léelo completo antes de seguir.

## Cómo trabajamos (acuerdos de Willie)
- Español, trato cercano ("bro"). Respuestas claras y cortas; explicar el porqué.
- **Todo se revisa primero en localhost** (`npm run dev` → `http://localhost:3000`). Willie dice si le gusta o no. **No subir a `main` ni desplegar sin su visto bueno.**
- "No dañar nada": cambios nuevos aislados o en vista previa primero (ej. `?v=2`).
- **Nada inventado**: si un dato no existe, se marca "sin dato" / "aproximado" y se confirma con él.
- Cuidado: si el `.env` local apunta a la Supabase real (proyecto `qtjpvztpgfymjhhpoouq`), lo que se guarde desde localhost cae en datos reales.
- Pruebas antes de subir: `cd server && npm run test:star` (24) y `npm run test:store` (50).
- Carpeta local de Willie: `D:\!OFFSZN\PROYECTOS\OFFSZN`. Repo: `williebs64uwu-create/OFFSZN`. Se fusionó por PRs #28 a #33.

## Lo construido
1. **CRM > Resumen**: lee el libro nuevo (bruto y neto) desde el 31 oct 2026.
2. **CRM > Finanzas** (`crm/js/finanzas.js`, API `server/src/infrastructure/http/controllers/FinanceController.js`):
   - Libro `finance_income` (un pago = una fila, único por `source+ref`), con bruto, comisión y neto. Se anota solo al cobrar (PayPal, Yape web, cuotas STAR, tienda, Coca-Cola, Promo 2x1, venta manual del CRM) con funciones **seguras**: nunca rompen un cobro.
   - Gastos en **soles**, solo 3 categorías: GASEOSA, COMIDA RÁPIDA, SUSCRIPCIÓN IMPORTANTE (esta exige nota). Con N° de operación opcional para no duplicar.
   - Cuenta del banco: **S/ 26.824,00 al 31-10-2026**, editable, **nunca se suma sola**. Dólar de referencia **3,37**.
   - Corte: solo cuenta desde `2026-10-31 00:00` hora de Lima. Lo anterior vive en **Histórico (plugins)** (aproximado, solo plugins, no suma a nada).
3. **Panel de licencias** (`owner/licencias.html`, paso 2 "Pago recibido"): método, moneda (USD / soles / pesos argentinos) y precio dado, o "Sin dato". USD = lo dado (PayPal), soles = neto (Yape), pesos argentinos = pendiente. Queda como "Acción de Willie".
4. **Pesos argentinos**: Mercado Pago → amigo (Sayko) → Binance → Yape en soles. El pago queda "por confirmar" hasta que llegan los soles; el depósito se reparte entre los pagos en proporción a los pesos y **no se anota como venta nueva** (tabla `finance_deposits`, método `mp_argentina`).
5. **Yape directo por capturas** (a fin de mes): positivo = venta, negativo = gasto; se evita duplicar con el N° de operación; si no dice producto se propone "producto aproximado: Easy Mix 15 US$ × 3,37 = ~S/ X, ¿sí/no?" y Willie confirma. Si el precio ya se puso en el panel de despacho, la captura lo confirma, no lo suma otra vez.
6. **Precios de Yape en el servidor** (`server/src/shared/store/yapePricing.js`): el USD debe ser uno de los que cada plugin puede asignar; los soles = USD × `YAPE_EXCHANGE_RATE_PEN` (variable de Vercel), redondeado al sol. Cassette S/ 25 fijo. STAR CHAIN: 49 US$ / S/ 185 fijos, con cupón. El modal pide el monto a `/api/orders/yape/quote`.
7. **STAR CHAIN** (producto id 5003, 49 US$; `plugins/checkout.html`):
   - Pago único con PayPal (botones reales), Yape rápido (modal), Mercado Pago y Binance por WhatsApp.
   - **3 cuotas** por suscripción de PayPal (3 × 16,33). Cuota 1 y 2 → clave `STAR-SUB` de 1 mes (la anterior se revoca); cuota 3 → `STAR-FULL` de por vida; cobro fallido → se revoca la clave temporal hasta que se pague. Código en `server/src/infrastructure/services/starSubscriptionService.js`.
   - Plan de PayPal creado: `P-70S15339G4126504KNLTEJ4A`. Webhook `39N61090313861030` con los 5 eventos ya activados (botón en CRM > Estado del sistema).
   - Cupones `OFFSZN`, `STAR`, `WILLIE`, `GODMIXING` (10%, solo producto 5003).
8. **Login de plugins** (`plugins/iniciar-sesion.html`) ahora usa Supabase Auth (antes usaba un sistema roto). Enlaces legales arreglados (`/legal/...`).
9. **Diseño nuevo de la página de preset (vista previa)**: `/preset/<slug>?v=2` (`preset.html`, `css/preset-page.css`, `script/preset-page.js`; ruta en `server/src/app.js`). Referencias de Willie: ocularsounds.com (premium, oscuro) y thevoxbox.shop (limpio, antes/después al frente). RAW/PRESET corre dos audios sincronizados.

## Datos que importan
- De 39 presets públicos, **solo 7 tienen audio de antes distinto**; 26 repiten el mismo archivo; 5 no tienen audio. Para lucir el antes/después hay que subir el RAW de los que más venden.
- Mejor mes registrado en la base (sept 2026): 62 ventas, US$ 517. Pico de Willie: ~S/ 5.000 al mes (incluye Payhip y cobros manuales). Meta: S/ 10.000.
- No hay afiliados (ya no se trabaja con ellos). Reembolsos: por ahora no.

## Historial de lo fusionado a `main` (para ubicarte con `git log`)
- **#28** CRM: el Resumen suma las ventas propias del marketplace; los correos de venta llevan etiqueta de canal.
- **#30** Login real de plugins (Supabase), checkout de STAR CHAIN con PayPal real, cuotas por suscripción, Yape rápido y precio seguro de Yape (soles = USD × variable de Vercel).
- **#31** Finanzas del CRM (libro de ingresos, gastos, banco), campos de pago en el panel de despacho, checkout de 3 botones, botón de avisos de PayPal.
- **#32** Pesos argentinos confirmados con el depósito, gastos con N° de operación, enlaces legales arreglados.
- **#33** Página de preset nueva en vista previa (`?v=2`).
- **#34** Este archivo.

## Pendientes (expedientes), con su estado
**Esperando a Willie**
- Revisar en localhost la página de preset v2 (`/preset/<slug>?v=2`) y decir qué cambiar. Luego enviar más diseños (tienda, landing, resto de páginas).
- Poner el link del instalador de STAR CHAIN (Google Drive) en la variable `STAR_DOWNLOAD_URL` de Vercel. Dijo que lo hace "al final".
- Pruebas con dinero real que **todavía no se han hecho**: compra de STAR CHAIN (49 US$ y con cupón), una cuota de 16,33, un cobro de Yape de un plugin y un despacho de prueba en el panel. Ver que cada una aparezca en CRM > Finanzas y usar "Verificar".
- A fin de mes: capturas de Yape y del banco para registrar y comparar; confirmar los pesos argentinos con el depósito de Sayko.

**Para hacer cuando Willie apruebe**
- Hacer la página de preset v2 la principal (quitar `noindex` de `preset.html`) y extender el diseño a tienda y landing.
- Revisar precios cuando las páginas estén listas.
- Unificar el catálogo: los IDs y precios de plugins están repetidos en unos 6 archivos (`pluginRegistry.js`, `yapePricing.js`, `YapeController.js`, `PayPalController.js`, `plugin-checkout.js`, páginas de plugins).
- Subir el audio RAW de los presets que más venden (hoy solo 7 de 39 tienen antes/después distinto).

**Ideas ya conversadas, aún sin hacer**
- Reembolsos y disputas (hoy un reembolso en PayPal seguiría contando como ingreso). Willie dijo "por ahora no".
- Revisión diaria contra PayPal (activar "Transaction search" en la app de PayPal), backups diarios de Supabase, confirmar el régimen tributario con un contador (a S/ 10 mil mensuales cambia de tramo).
- Mercado Pago automático para clientes argentinos (hoy es manual).

## Límites conocidos (para no sorprenderse)
- El Resumen del CRM ya no sabe el **país** de cada venta: el libro no guarda país, así que "Por país" sale "N/D". Existe la columna `country`, sin llenar.
- Las estadísticas de **licencias** del panel (`owner/licencias.html`, gráficos de ingresos) siguen **estimando por tramos de precio**; no leen el libro nuevo. Conviene reemplazarlas o rotularlas como estimado.
- "Productos y precios" del CRM sigue leyendo las tablas viejas (`orders` / `order_items`), donde `price_at_purchase` es el precio de lista, no lo cobrado.
- Los DAWs de la página de preset salen como texto, no como logos (faltan los íconos).
- En el entorno de pruebas de la nube no se pudieron hacer cobros reales ni ver Vercel: todo lo que toca dinero se probó con simulaciones, no con pagos de verdad.

## Prompt para arrancar la sesión local
> Lee `docs/CONTEXTO-SESION.md` completo y respétalo (cómo trabajamos, reglas del dinero, pendientes). Corre `git pull origin main`, `npm install` y `npm run dev`, y déjame abrir `http://localhost:3000/preset/preset-de-remers?v=2`. Todo se revisa primero en localhost; no subas nada a `main` ni despliegues sin que yo lo apruebe. Cuando termines de leer, resúmeme en 10 líneas qué entendiste y qué sigue, para que yo corrija lo que falte.

## Actualización 1 nov 2026 (tienda de Willie: presets, carrito, checkout)
- **Dirección oficial de un preset de artista:** `/willieinspired/presets/<artista>` (ej. `/willieinspired/presets/remers`). `/presets/<x>` y `/willieinspired/presets/artistas/<x>` redirigen ahí. El marketplace sigue en `/preset/<slug>` sin cambios.
- **Página de preset y landing** comparten diseño (`preset.html`, `css/preset-page.css` dentro de `.pp`, `script/preset-page.js`). En la landing el artista cambia sin recargar (`?artista=`). Menú, carrito, buscador y pie son los modulares de la tienda (`willieinspired/assets/store.js`).
- **Descuento por cantidad (solo presets de artistas, lo calcula el servidor en `shared/store/pricing.js`):** 2 → 10%, 3 → 20%, 4 o más → 25%. No se acumula con otras ofertas; con un cupón gana el que más ahorra. Las ventas manuales del CRM no lo aplican.
- **Cupones de la tienda:** WILLIE10 (10%), VOCES (20%), SPECIAL (15%), OFFSZN (US$5). Un cupón que no existe ahora avisa y no deja pagar.
- **Checkout `/willieinspired/checkout`:** correo, PayPal/tarjeta, y recuadros de Yape (ventana tipo Easy Mix, cobra en la tienda), Mercado Pago (WhatsApp, total en ARS con 1 USD = 1500 ARS) y Binance (ventana con tu ID 1257117526). Todo en dólares; Yape en soles. Los clics de Yape/MP/Binance se guardan en `/api/plugin/payment-click` (panel `/owner/pagos-manuales`).
- **Buscador del menú:** tolerante a errores de escritura, sin tildes ni mayúsculas, sin atajos visibles.
- **Pendiente tuyo / sin probar:** QR de Binance (guardar captura en `images/payments/binance-qr.png`), audios antes/después de la mayoría de artistas, capturas propias para "Todo ya viene ajustado" (`images/preset-como-funciona/`), y **cobros reales con PayPal y Yape** (ninguno se ha probado). La prueba `admin-key` falla en esta PC solo porque `server/.env` ya trae la clave del panel.
