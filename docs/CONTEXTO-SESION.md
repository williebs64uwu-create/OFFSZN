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

## Pendiente / siguiente
- Willie revisa en localhost la página de preset v2 y dice qué cambiar. Al aprobar: hacerla la página por defecto de presets (quitar `noindex`) y seguir con tienda, landing y el resto de páginas con los diseños que él envíe.
- Revisar precios cuando estén las páginas. Unificar el catálogo (los IDs/precios de plugins se repiten en ~6 archivos) al rediseñar la tienda.
- Más adelante: manejo de reembolsos/disputas, revisión diaria contra PayPal (activar "Transaction search" en la app), backups de Supabase, confirmar régimen tributario con un contador.
- A fin de mes: Willie envía capturas de Yape y del banco para registrar y comparar.
