# Errores Comunes de Desarrollo en OFFSZN

## 9. Bloqueo de Pasarelas de Pago (PayPal CSP)

**Descripción del error:**
El SDK de PayPal no carga o los botones no aparecen en la página de checkout, lanzando errores de `Content Security Policy (CSP)` en la consola.

**Cuándo ocurre:**
Sucede cuando Helmet.js está configurado por defecto y no permite conexiones externas a los dominios de PayPal.

**Solución:**
Actualizar las directivas de Helmet en `app.js` permitiendo explícitamente los dominios de PayPal en:
- `scriptSrc`: `paypal.com`, `sandbox.paypal.com`
- `imgSrc`: `paypalobjects.com`, `*.paypal.com`
- `connectSrc`: `api.paypal.com`, `api-m.paypal.com`
- `frameSrc`: `paypal.com`

## 10. Interferencia de COOP/COEP con Popups (Google/PayPal Auth)

**Descripción del error:**
Los popups de autenticación (como los de Google o PayPal) se abren pero no pueden devolver el token a la ventana principal, o la ventana se queda en blanco.

**Cuándo ocurre:**
Al habilitar políticas estrictas para FFmpeg.wasm (`Cross-Origin-Embedder-Policy: require-corp`), estas bloquean la comunicación entre ventanas de distinto origen.

**Solución:**
- Establecer `crossOriginEmbedderPolicy: false` en la configuración global de Helmet.
- Desactivar `crossOriginOpenerPolicy: false` globalmente para permitir que los popups se comuniquen con el `window.opener`.

## 11. Errores 404 en Activos Estáticos (Logos de Yape/Plin en Producción)

**Descripción del error:**
Imágenes que cargan localmente (como `/images/yape.png`) devuelven 404 al desplegar en producción (Render/Vercel).

**Cuándo ocurre:**
Debido a la estructura de carpetas `root/public` vs `server/public` y cómo el servidor Express sirve los archivos estáticos.

**Solución:**
Unificar el middleware de archivos estáticos en `app.js` para buscar en ambas rutas y priorizar la carpeta de servidor para activos críticos:
```javascript
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../public')));
```

## 12. Credenciales Supabase Expuestas en Páginas Huérfanas (404.html)

**Descripción del error:**
Los logs de seguridad detectan la estructura de credenciales clave `window.SUPABASE_ANON_KEY` codificada estáticamente en archivos en la raíz del proyecto.

**Cuándo ocurre:**
Ocurre frecuentemente en plantillas simples o páginas aisladas (como `404.html` o `index.html` original) donde en lugar de cargar el manejador global del entorno se pegaron directamente las APIs.

**Solución:**
Eliminar íntegramente las variables estáticas y referenciar el handler encargado desde la raíz:
```html
<script src="/env.js"></script>
```

## 13. Exposición de Credenciales en Funcionalidades "Beta" (Studio/Reels)

**Descripción del error:**
Al desarrollar módulos nuevos o bajo etiquetas "BETA" (`studio/reels.html`), se tiende a replicar el error de configuración estática de Supabase, ignorando la arquitectura global de `/env.js`.

**Cuándo ocurre:**
Ocurre en archivos que se crean como prototipos rápidos y luego se integran al flujo principal sin pasar por un auditoría de secretos.

**Solución:**
Estandarizar la cabecera de todos los archivos `.html` nuevos para que incluyan la carga de entorno dinámica:
```html
<script src="/env.js"></script>
```


## 8. Scripts Globales Faltantes en SPA/Páginas Independientes (Search/Favorites)

**Descripción del error:**
Botones de interactividad (Like, Compartir, Reproducir) no funcionan o lanzan `ReferenceError` porque los managers globales no están cargados.

**Cuándo ocurre:**
Al crear nuevas páginas o componentes (como `search.html`) y olvidar importar scripts de soporte como `favorites-manager.js` o `share-modal.js`.

**Solución:**
Asegurarse de incluir los scripts necesarios en el pie del `<body>` antes del script específico de la página:
```html
<script src="/script/favorites-manager.js"></script>
<script src="/script/share-modal.js"></script>
<script src="/script/search.js" type="module"></script>
```

**Mejora de UX (Mar 10, 2026):**
Se reemplazaron los badges de formato ("WAV/STEMS") por información técnica relevante (**BPM** y **KEY**) en formato de cuadrados (`.info-square-v2`) para cumplir con estándares de la industria musical.


## 1. ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep

**Descripción del error:**
El navegador bloquea la carga de un recurso (usualmente imágenes de Cloudinary o Cloudflare R2) en la consola con el mensaje:
`net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep 200 (OK)`.

**Cuándo ocurre:**
Este error sucede cuando el documento principal tiene habilitada la cabecera `Cross-Origin-Embedder-Policy: require-corp` (necesaria para FFmpeg.wasm) y la página intenta cargar una imagen de otro dominio (cross-origin) mediante una etiqueta `<img>` tradicional **sin especificar que la petición admite CORS**.

Aun cuando el servidor remoto (Cloudinary) responda con un 200 OK, el navegador enforcerá la política COEP y ocultará el recurso.

**Solución:**
Encontrar las etiquetas `<img>` generadas (ya sea en HTML o dinámicamente en JavaScript) que consumen esos dominios y agregarles el atributo `crossorigin="anonymous"`.

*Ejemplo en `profile-public.js` o `avatar-manager.js`:*
```javascript
// Incorrecto (fallará por COEP)
avatarContainer.innerHTML = `<img src="${user.avatar_url}" />`;

// Correcto
avatarContainer.innerHTML = `<img crossorigin="anonymous" src="${user.avatar_url}" />`;
```

Asegurarse también de que el proveedor externo (R2 / Cloudinary) tenga configurada una política CORS que devuelva `Access-Control-Allow-Origin: *`.

## 2. Bloqueo de Acciones Duplicadas (Double Click / Rapid Save)
**Descripción:** Clics rápidos disparan múltiples peticiones.
**Solución:** Usar un flag `isSaving` para bloquear botones y retornos de función durante procesos activos.

## 3. Solapamiento de Elementos (Floating Layouts)
**Descripción:** Contadores `absolute` chocan con scrollbars de textareas.
**Solución:** Usar `position: static` o margen inferior para separar el contador del área de interacción del scroll.



## 4. Fallo de Integridad de Subrecursos (SRI) y Race Conditions

**Descripción:**
El navegador bloquea la carga de librerías externas o estas no se inicializan correctamente a pesar de cargar el script.

**Cuándo ocurre:**
1. **Hash Mismatch**: Al usar alias como `@2`, el CDN actualiza la versión y el hash deja de coincidir.
2. **Race Condition**: `AuthUtils.initSupabase()` se dispara antes de que la librería de Supabase o las variables de entorno (`env.js`) estén listas en el DOM.

**Solución Final:**
1. **Fijar la versión exacta** (ej. `@supabase/supabase-js@2.48.1`) para garantizar que el hash sea estático.
2. **Usar el hash exacto de la consola**: El navegador indica el hash "recibido" vs el "esperado". Copiar el recibido.
3. **Escuchador de Carga**: Usar `window.addEventListener('load', ...)` para inicializar librerías después de que todo el entorno esté listo.

*Ejemplo de implementación robusta en `gian.html`:*
```html
<script src="https://.../supabase-js@2.48.1" integrity="sha384-HASE_EXACTO" crossorigin="anonymous"></script>
<script>
    window.addEventListener('load', () => {
        if (window.AuthUtils) window.AuthUtils.initSupabase();
    });
</script>
```

## 5. Bloqueo de CSP (Tailwind & CDNs)

**Descripción:**
El navegador bloquea la carga de librerías externas o fuentes dinámicas debido a una política de seguridad de contenido (CSP) estricta.

**Cuándo ocurre:**
Al agregar nuevas librerías (como `cdn.tailwindcss.com`) que no están explícitamente autorizadas en el header de seguridad del servidor.

**Solución:**
Actualizar las directivas de `helmet` en `app.js` para incluir el dominio permitido en `scriptSrc`.

## 6. XSS en Contenido Dinámico (DOM Injection)

**Descripción:**
Posibilidad de inyección de código malicioso si se usan datos proporcionados por usuarios para construir HTML sin escapar.

**Cuándo ocurre:**
Al usar `innerHTML` o `insertAdjacentHTML` con variables que pueden contener etiquetas `<script>`.

**Solución:**
Implementar una función `escapeHTML(str)` y aplicarla a todos los datos dinámicos antes de su inserción en el DOM.
## 7. Race Condition en Configuración de Tailwind CSS

**Descripción del error:**
Error `tailwind is not defined` al intentar configurar `tailwind.config` en un script inline.

**Cuándo ocurre:**
Sucede si el script de configuración inline se ejecuta antes de que el script principal de `cdn.tailwindcss.com` haya terminado de cargar y definir el objeto global `tailwind`.

**Solución:**
Implementar una función de inicialización con guarda y reintento (`setTimeout`) para asegurar que el objeto `tailwind` exista antes de usarlo.

```javascript
function initTailwind() {
    if (typeof tailwind !== 'undefined') {
        tailwind.config = { ... };
    } else {
        setTimeout(initTailwind, 200);
    }
}
initTailwind();
```

## 8. Inconsistencia de SRI en CDNs dinámicos

**Descripción:**
Bloqueo de scripts por fallo en integridad (SRI) tras actualizaciones automáticas del CDN (ej. use de `@2` o `@latest`).

**Solución:**
Fijar siempre la versión semántica completa (ej. `@2.48.1`) y generar el hash SRI correspondiente a esa versión específica. No usar etiquetas de versión mayor (`@2`) con SRI.

## 9. Placeholders de Imagen de Perfil (Avatar Fallback)

**Descripción:**
Evitar imágenes rotas o vacías cuando un usuario no tiene `avatar_url` o la carga falla.

**Solución Implementada:**
1. **Detección**: Si `avatar_url` es null, mostrar un `div` con la **inicial** del nickname.
2. **XSS en Iniciales**: El nickname DEBE ser escapado antes de extraer la inicial, para evitar inyección si un usuario usa algo como `<script>` de nombre.
3. **Escapado en Atributos**: Al usar `onerror="handleError(..., 'nickname')"`, las comillas simples del nickname deben ser escapadas (`.replace(/'/g, "\\'")`) para no romper el atributo de JavaScript.

*Ejemplo en `siguiendo.js`:*
```javascript
const nicknameEscaped = escapeHTML(user.nickname);
const initial = nicknameEscaped.charAt(0).toUpperCase();

const avatarContent = avatarUrl
    ? `<img src="${avatarUrl}" onerror="handleError(this, '${nicknameEscaped.replace(/'/g, "\\'")}')">`
    : `<div class="placeholder">${initial}</div>`;
```

# Registro de Errores y Soluciones - OFFSZN

Este documento registra los errores técnicos identificados durante el desarrollo y cómo han sido solucionados.

---

## 1. Error 500 en API de Productores (Producers API)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `server/src/infrastructure/http/controllers/UserController.js` - `getAllProducers`

### Problema:
Al intentar cargar la grilla de productores en `comunidad/productores.html`, el servidor respondía con un error **500 Internal Server Error**.

### Causa Raíz:
El código del backend intentaba seleccionar una columna inexistente llamada `profile_cover` en la tabla `users` de Supabase. La columna correcta en la base de datos es `banner_url`.

### Solución:
1. Se actualizó la consulta en `UserController.js` para usar `banner_url`.
2. Se aplicó un alias (`profile_cover:banner_url`) en la consulta de Supabase para mantener la compatibilidad con el frontend sin necesidad de modificar los scripts del cliente.
3. Se aseguró que los parámetros `limit` y `page` sean tratados siempre como enteros (`parseInt`) para evitar cálculos de rango erróneos.

---

## 2. SyntaxError y Visuales Rotos en Cards (Avatar Fallback)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `script/producers.js` / `comunidad/productores.html`

### Problema:
Se reportaron SyntaxErrors en la consola y cards que se veían mal (con iniciales superpuestas o HTML roto). Esto ocurría porque el atributo `onerror` inyectaba HTML de forma insegura, rompiendo la estructura de las comillas.

### Solución:
1. Se creó una función global `window.handleProducerAvatarError` que maneja el error de forma limpia sin inyectar HTML directamente en el atributo `onerror`.
2. Se reemplaza solo el elemento `<img>` por el placeholder, manteniendo la integridad del contenedor y la estrella de ranking.
3. Se escapan los caracteres especiales en los nicknames para evitar rupturas de strings en JS.

---

## 3. Bloqueo de Imágenes por CSP (via.placeholder.com)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `server/src/app.js` (Helmet config)

### Problema:
Las imágenes de prueba o fallbacks que apuntaban a `via.placeholder.com` eran bloqueadas por el navegador debido a la política de Content Security Policy (CSP).

### Solución:
Se añadió `https://via.placeholder.com` a la lista blanca de `imgSrc` en la configuración de Helmet del servidor. Esto permite cargar estas imágenes de forma segura mientras se migran a recursos definitivos.

---

## 4. Corrección de Ranking "TOP 1-10" y Exclusiones
**Fecha:** 6 de marzo de 2026
**Ubicación:** `script/producers.js` / `/api/leaderboard`

### Problema:
Se requería que el ranking fuera real (basado en el leaderboard mensual) y que las cuentas de prueba (`user2pr25`, `testeo2`, etc.) nunca aparecieran en el top y siempre estuvieran al final de la lista. Además, el ranking solo debe ser visible en las pestañas de "Trending" y "Popular".

### Solución:
1. **Ranking Real:** Se integra el fetch a `/api/leaderboard` para obtener el Top 10 oficial basado en puntos.
2. **Exclusión Estricta:** Se creó una lista de UUIDs (`EXCLUDED_PRODUCERS`) en el frontend que:
   - Bloquea cualquier asignación de rango (estrella TOP) aunque tengan puntos.
   - Los empuja al final de la lista mediante un `sort` personalizado antes de renderizar.
3. **Visibilidad por Filtro:** Se condicionó la visibilidad del badge "TOP X" para que solo aparezca si el filtro activo es "Trending" o "Popular". En "Recientes" o "A-Z" se oculta para evitar inconsistencias visuales.
4. **Traducción:** Se cambió el título principal a "Encontrar Creadores" y los placeholders a español.

---

## 5. Prioridad de Imagen y Robustez de Avatares
**Fecha:** 6 de marzo de 2026
**Ubicación:** `UserController.js` / `productores.html` / `script/producers.js`

### Problema:
Vulnerabilidad visual cuando fallan servicios externos de placeholders (como `via.placeholder.com`) y necesidad de priorizar usuarios con foto.

### Solución:
1. **Filtro de Imagen:** El backend (`UserController.js`) y el frontend (`producers.js`) ahora priorizan a los usuarios que tienen `avatar_url` o `profile_cover` definido.
2. **Fallback Seguro:** El manejador `window.handleProducerAvatarError` ahora reemplaza fallos de imagen directamente con un `div` de iniciales generado localmente, eliminando la dependencia de servicios externos que puedan causar errores de resolución (como el visto en consola).
3. **Seguridad:** Se aplicó un incremento de versión (`?v=17`) al script en el HTML para forzar la limpieza de caché tras estos cambios críticos.

---

## 6. Refinamiento Estético: Black & White total
**Fecha:** 6 de marzo de 2026
**Ubicación:** `producers.css` / `productores.html`

### Problema:
Uso de color morado (`#8b5cf6`) en las pestañas activas de productores, lo cual rompía la estética "Black & White" de la marca. Icono de filtros no intuitivo (deslizadores vs embudo).

### Solución:
1. **Paleta B&W:** Se cambió el fondo de `.category-tag.active` de morado a blanco (`#fff`) con texto negro (`#000`).
2. **Icono Funnel:** Se reemplazó el icono `bi-sliders` por `bi-funnel` (embudo) para representar mejor el filtrado por roles.
3. **Estructura:** Se movió el botón de filtros avanzados fuera del contenedor de pestañas para diferenciarlo visualmente y se envolvió en un `filter-row-wrapper` para mantener la alineación.
4. **Dropdown:** Se ajustó la opción seleccionada del dropdown para usar blanco sólido en lugar de tintes morados.

---

## 7. Cards de Productores "Angostas" (Flex Shrink)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `producers.css` / `.pro-grid`

### Problema:
Al introducir un contenedor flex (`.pro-grid-layout-container`) para el sidebar, el grid (`.pro-grid`) se encogía a su tamaño mínimo de contenido, haciendo que las cards se vieran muy angostas y amontonadas en el centro.

### Solución:
Se forzó `width: 100%` en `.pro-grid` y `.pro-grid-section` para que ocupen todo el espacio disponible del contenedor centrado (hasta 1400px), restaurando el ancho original de las cards y permitiendo que se expandan correctamente.

---

## 8. Lógica Final de Rankings y Exclusiones
**Fecha:** 6 de marzo de 2026
**Ubicación:** `producers.js` / `UserController.js`

### Problema:
Necesidad de sincronizar rankings dinámicos con exclusiones de seguridad para cuentas de prueba que no deben "ensuciar" el top público.

### Solución:
1. **Exclusión Estricta:** Las cuentas en `EXCLUDED_PRODUCERS` (ej. `user2pr25`) nunca reciben el badge de ranking, incluso si tienen puntos altos en la DB. Se empujan al final mediante un `sort` que prioriza: 1) Tener foto, 2) No ser excluido.
2. **Contextualización Visual:** Se implementó una lógica en `renderProducers` para que la estrella de "TOP" solo aparezca si la pestaña activa es "Todos" o "Popular". En "Recientes", el ranking se oculta para no confundir al usuario con el orden cronológico.
3. **Seguridad (Photo Rule):** En la pestaña "Recientes", se filtran cuentas sin fotos de perfil/portada para mantener un estándar visual premium.

---

## 9. Checkboxes Invisibles (Doble-Toggle)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `script/producers.js` / `producers.css`

### Problema:
Los checkboxes de los filtros de roles no mostraban el estado "marcado" (fondo blanco con check) al hacer clic. Esto ocurría por un conflicto de eventos: el navegador marcaba el checkbox automáticamente por estar dentro de un `<label>`, y el script de JS volvía a cambiar el estado manualmente en el evento `click`, haciendo que se cancelaran entre sí.

### Solución:
1. **JS**: Se eliminó el escuchador de eventos `click` en el contenedor del item y se dejó que el navegador maneje el cambio del checkbox nativamente. Ahora el script solo escucha el evento `change` del input.
2. **CSS**: Se forzó el uso de `bootstrap-icons` con `!important` y un `font-weight: 900` en el pseudo-elemento `::after` para garantizar que el icono de la palomita sea visible sobre el fondo blanco.
3. **ID Sync**: Se sincronizaron los valores de los checkboxes con los nombres de los chips para evitar discrepancias al eliminar filtros desde la UI principal.

---

## 10. Gaps en el Top 1-10 (Sincronización de Exclusiones)
**Fecha:** 6 de marzo de 2026
**Ubicación:** `LeaderboardController.js` (Backend) / `producers.js` (Frontend)

### Problema:
El ranking mostraba números saltados (ej: 1, 2, 6, 7) porque las cuentas de prueba estaban siendo filtradas en el frontend pero seguían ocupando puestos en el cálculo del backend.

### Solución:
Se sincronizaron las listas de exclusión de IDs en ambos lados. Ahora el backend ignora por completo a los usuarios de prueba al calcular los puestos, asegurando un Top 10 real y continuo de usuarios legítimos.

---

## 11. Portadas R2 Rotas (Error 404 en Covers de Productos)
**Fecha:** 15 de marzo de 2026
**Ubicación:** `script/auth-utils.js` / `server/src/infrastructure/http/routes/r2.routes.js` / `script/r2-loader.js`

### Problema:
Algunos beats (como "Pulsar 200") mostraban portadas rotas en el feed de Explorar, generando errores 404 en la consola. Esto ocurría porque la base de datos guardaba la URL completa de R2 (en lugar de la ruta relativa), y la función encargada de firmarlas (`getAuthorizedUrl`) asimilaba que no necesitaba firma al detectar `http`, evadiendo el proceso y causando denegación de acceso en las cubiertas. Además, en caso de fallar, la ruta pública de fallback en el backend generaba un error interno (`PathError`) por sintaxis incompatible en Express 5.

### Solución:
1. **Detección Mejorada de URLs R2 (`auth-utils.js`)**: Se actualizó `getAuthorizedUrl` para procesar correctamente las URLs absolutas de R2 y asegurar que sean firmadas si no contienen una firma activa (`X-Amz-Signature`). Además, se corrigió la construcción de la URL de fallback del API en `_handleSigningFailure`.
2. **Corrección de Ruta Backend (`r2.routes.js`)**: Se solucionó el error fatal en Express 5 (`PathError: Missing parameter name`) reemplazando el patrón `/r2-public/:key*` por una expresión literal nativa `/^\/r2-public\/(.*)/`.
3. **Supresión de Errores Visuales (`r2-loader.js`)**: Se asignó un `src` temporal con un GIF transparente al identificar elementos con atributo `data-r2-version`, impidiendo que el navegador lance el error inicial de "Not Found" mientras se obtiene asíncronamente la firma.

---

## 12. Vulnerabilidad de Seguridad y Validación de Entorno en Páginas Sensibles
**Fecha:** 15 de marzo de 2026
**Ubicación:** `pages/` (`login.html`, `register.html`, `update-password.html`, `verify-email.html`, `purchase-success.html`, `success.html`, `welcome.html`)

### Problema:
Se identificaron varias páginas HTML sensibles que mantenían codificadas en el código fuente (`hardcoded`) las credenciales `SUPABASE_URL` y `SUPABASE_ANON_KEY`, violando las políticas de seguridad estipuladas. Además, los recursos de CDN externos carecían del atributo `crossorigin="anonymous"`, lo que podría ocasionar bloqueos por políticas COEP. Finalmente, en `success.html`, se detectó una inyección directa de variables de base de datos en el `innerHTML`, exponiendo el sitio a ataques XSS.

### Solución Implementada:
1. **Remoción de Credenciales Relativas**: Se eliminaron los bloques de scripts con las claves hardcoded en el `<head>` de los 7 archivos HTML, inyectando de forma segura las variables configuradas en el entorno desde el servidor mediante `<script src="/env.js"></script>`.
2. **Cabeceras Cross-Origin**: Se añadió el atributo `crossorigin="anonymous"` a todas las llamadas externas de scripts, fuentes de Google Fonts, iconos y estilos (como TailwindCSS y CropperJS) para cumplir cabalmente con la política de seguridad estricta y evitar excepciones de CORS/COEP en el navegador.
3. **Mitigación XSS (DOM Injection)**: En `success.html`, se incluyó la función `escapeHTML()` para el renderizado dinámico del `item.product.name` y los nombres de las licencias antes de su inyección en la vista html, eliminando un posible vector de ataques por inyección.

---

## 13. Errores 403 Forbidden por URLs Firmadas Expiradas en DB
**Fecha:** 16 de marzo de 2026
**Ubicación:** Tabla `products` (campos `image_url`, `audio_url`) / `r2-storage.service.js`

### Problema:
Al guardar productos, se estaban almacenando URLs firmadas completas de R2 (con `X-Amz-Signature`). Estas URLs expiran en 24h, dejando el recurso inaccesible (403 Forbidden) permanentemente en la base de datos.

### Solución:
1. **Limpieza de DB:** Se ejecutó un script para convertir todas las URLs absolutas de R2 en rutas relativas (ej. `products/covers/.../file.jpg`).
2. **Firma Dinámica:** El frontend (`AuthUtils.getAuthorizedUrl`) ahora detecta si la URL es de R2 y solicita una firma fresca al backend solo cuando es necesario mostrar el recurso.
3. **Regla de Oro:** NUNCA guardar tokens de acceso o firmas temporales en Supabase. Guardar solo el "Key" o "Path" del archivo.

---

## 14. Bloqueo CORB (Cross-Origin Read Blocking) en R2
**Fecha:** 16 de marzo de 2026
**Ubicación:** `server/src/infrastructure/services/r2-storage.service.js`

### Problema:
Las imágenes de R2 no cargaban en el navegador, mostrando un error de CORB en la consola. El inspector mostraba que las URLs firmadas incluían el parámetro `x-amz-checksum-mode=ENABLED`, el cual Cloudflare R2 maneja de forma que activa protecciones de seguridad del navegador.

### Solución:
Desactivar explícitamente el cálculo de checksums en el cliente de S3 de AWS SDK:
```javascript
const s3Client = new S3Client({
    // ...
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
});
```
Esto elimina el header de checksum en la URL firmada y permite la carga transparente del recurso.

---

## 15. Inconsistencia de Versiones (V1 vs V2) en R2 Storage
**Fecha:** 16 de marzo de 2026
**Ubicación:** `r2.routes.js` / Tabla `products` (columna `r2_version`)

### Problema:
Se detectaron 404s persistentes en productos específicos (ej. koimattoru). La causa era que los productos estaban etiquetados como `r2_version: v2` en la base de datos, pero los archivos físicos solo existían en el bucket original (V1). El servidor intentaba firmarlos con la cuenta V2, resultando en "Object Not Found".

### Solución:
1. **Auditoría Cruzada:** Se creó un script (`fix_versions.js`) que verifica la existencia real del archivo en ambos buckets y corrige la columna `r2_version` en Supabase según corresponda.
2. **Detección Automática:** En el backend, se implementó lógica para detectar la versión basada en el endpoint o el nombre del bucket contenido en la URL original antes de proceder a la firma.

---
---

## 16. Inconsistencia de Carpetas en Migración a Supabase (`audio` vs `mp3_tagged`)
**Fecha:** 18 de marzo de 2026
**Ubicación:** `r2-storage.service.js` / `AuthUtils.js`

### Problema:
Los beats migrados desde R2 a Supabase Storage se organizaron en carpetas `mp3_tagged/`, pero el código del servidor y la base de datos a veces apuntaban a `audio/`. Esto causaba errores "Object Not Found" (404) al intentar firmar o acceder al recurso.

### Solución:
1. **Mapeo Inteligente**: Se actualizó la normalización en el backend para mapear `beats/mp3/` a `mp3_tagged/` automáticamente.
2. **Ciclo de Reintento**: Se implementó un loop que, si falla la firma en `mp3_tagged/`, intenta automáticamente en `audio/` (y viceversa) antes de devolver un error.

---

## 17. Conflicto de Cuentas R2 (Cuenta 1 vs Cuenta 2) y Smart Fallback Loop
**Fecha:** 18 de marzo de 2026
**Ubicación:** `r2.routes.js` (Ruta `/r2-public/`) / `auth-utils.js`

### Problema:
Con la introducción de una segunda cuenta de R2 (V2), el sistema ya no podía predecir con certeza dónde estaba un archivo basándose solo en su prefijo o ID. Reglas "greedy" forzaban erróneamente activos de R2 V2 hacia Supabase, rompiendo imágenes y audios.

### Solución:
1. **Smart Fallback Loop**: La ruta pública del backend ahora **itera** sobre todas las fuentes posibles (`v2`, `supabase`, `v1`) hasta que el recurso devuelve un 200 OK. Esto garantiza la carga sin importar en qué cuenta resida el archivo.
2. **Priorización de DB**: Se eliminaron las reglas forzosas en el frontend, delegando la decisión a la columna `r2_version` de la base de datos y usando el fallback loop como red de seguridad.

---

## 18. Doble Prefijo y URLs Supabase Anidadas
**Fecha:** 18 de marzo de 2026
**Ubicación:** `r2-storage.service.js` / `r2.routes.js`

### Problema:
Se detectaron errores de firma para rutas como `products/storage/v1/object/public/...`. Esto ocurre porque el sistema intenta tratar una URL completa de Supabase como si fuera una "key" relativa, añadiendo de nuevo el nombre del bucket al principio.

### Solución:
Implementar una limpieza de URL (URL Sanitization) más agresiva en el backend para detectar si el string recibido ya es una URL de Supabase y extraer únicamente la ruta del objeto antes de proceder a la normalización o firma.
