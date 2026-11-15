# CLYRA · licencia en OFFSZN

CLYRA es un plugin VST3 de efecto que se vende **aparte** de Orb. Su licencia usa el mismo backend de licencias de plugins de OFFSZN.

## Qué se hizo (13 nov 2026, sin commit ni despliegue)
- `server/src/shared/config/pluginRegistry.js`: entrada `{ id: 'clyra', prefix: 'CLYRA', displayName: 'CLYRA', trialDays: 3, exclusive: true }` y `clyra` en `KEYWORD_ORDER`. Seriales `CLYRA-(FULL|TRIAL|SUB)-XXXXXXXX-XXXXXXXX`. Los endpoints existentes `/api/plugin/request-trial | activate | validate` ya sirven para CLYRA (mandar `plugin_name: "CLYRA"`).
- `server/create_clyra_key.js`: crea una licencia FULL de por vida y la imprime (`node create_clyra_key.js [dispositivos]`, necesita `server/.env`).
- `server/tests/plugin-licensing.test.mjs`: prueba nueva de CLYRA (prefijo, activación, firma v2, exclusiva: una clave de CLYRA no activa Orb ni otros plugins y al revés). `npm run test:licensing`: 25 pruebas en verde.
- La licencia es exclusiva: una clave de Orb no abre CLYRA.

## Pendiente
1. Desplegar el backend **antes** de distribuir CLYRA con licencia; sin la entrada en el registro no puede activarse.
2. Variable `CLYRA_PRODUCT_IDS` (IDs del producto en la tienda) cuando exista el producto en `products`; página de producto y pago (10 US$).
3. Lado del plugin (proyecto `Clyra Plugin`): copiar y adaptar `Source/licensing` de Orb (LicenseManager, prefijo `CLYRA`, `plugin_name: "CLYRA"`) y bloquear el audio sin licencia. El instalador actual es beta sin licencia.
4. Precio decidido por el usuario: **10 US$** (pago único). Días de prueba por decidir (3 por defecto, como Orb).

## Landing (15 nov 2026, sin commit ni despliegue)
- `plugins/clyra.html`: página basada en la de SYNORA (misma estética), con demo animada de la cadena, prueba de 3 días (genera la clave con `/api/plugin/generate-trial-web`, `plugin_name: 'CLYRA'`), precio 10 US$ / S/ 30 (constante `SYNORA_PRICE` dentro del script) y FAQ.
- `images/plugins/clyra/card.jpg` y `og.jpg` (copias provisionales de las imágenes de CLYRA de Orb), tarjeta en `plugins/all.html` y rutas `/plugins/clyra` y `/plugin/clyra` en `_redirects`.
- Pendiente antes de publicar: producto `CLYRA` en la tienda (`CLYRA_PRODUCT_IDS`) para que funcione "Obtener CLYRA" (`/plugins/checkout.html?plugin=clyra&tier=full`); subir el instalador a Drive y poner su enlace en `CLYRA_DOWNLOAD_URL` (hoy el botón dice "Descarga próximamente"); desplegar el backend con la entrada `clyra`.
