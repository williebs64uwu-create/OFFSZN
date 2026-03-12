# Seguridad y CORS / COEP en OFFSZN

## Configuración de Cabeceras COEP y COOP (Cross-Origin Embedder Policy)

En OFFSZN se utiliza **FFmpeg.wasm** para algunas funcionalidades (como la compresión o manipulación de videos y recursos pesados). Para que FFmpeg funcione de manera óptima y utilice recursos avanzados del navegador como `SharedArrayBuffer`, el servidor (Express en `app.js`) inyecta cabeceras de aislamiento estricto:

```javascript
res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
```

### Impacto en Imágenes Externas (Cloudinary y R2)

Si una página web tiene `Cross-Origin-Embedder-Policy: require-corp` activo (o si un Service Worker o caché arrastra ese comportamiento), el navegador **bloqueará** cualquier recurso externo (como imágenes de `res.cloudinary.com` o el bucket de R2) a menos que se cumplan dos condiciones:

1. El recurso externo soporte y devuelva cabeceras CORS (`Access-Control-Allow-Origin`).
2. La etiqueta HTML que solicita el recurso incluya el atributo `crossorigin="anonymous"`.

**Ejemplo de código correcto:**
```html
<img crossorigin="anonymous" src="https://res.cloudinary.com/.../image.jpg" />
```

### Impacto en Audio Dinámico Externo (WaveSurfer / HTML5 Audio)

Al igual que las imágenes, si cargas pistas de audio externas usando librerías como `WaveSurfer.js` bajo una política COEP estricta, estas pueden ser bloqueadas si el dominio de origen no establece las cabeceras CORS apropiadas y la URL no está pre-firmada o se consume a través de un proxy habilitado para CORS (e.g. `getAuthorizedUrl` en R2/Supabase). Siempre obtén URLs autorizadas antes de pasarlas como fuente a reproductores HTML5 media.


### Canvas Tainted y Manipulación de Imágenes (Cropper.js)

En funcionalidades como el **Avatar Manager** (`avatar-manager.js`), se cargan imágenes externas dentro de un `<canvas>` oculto para recortarlas usando librerías como `Cropper.js`. Si la imagen externa se carga **sin** el atributo `crossorigin="anonymous"`, el canvas se marcará como *tainted* (contaminado) por motivos de seguridad, y llamadas como `canvas.toDataURL()` fallarán.

Por lo tanto, SIEMPRE que se inyecten imágenes dinámicas desde Cloudinary o Cloudflare R2, la buena práctica en OFFSZN es asegurar que cuenten con `crossorigin="anonymous"`.

## Gestión de Secretos (Variables de Entorno)

Nunca incrustes claves públicas o URLs de API (como las de Supabase) directamente en el código de archivos HTML o JS del cliente. Esto las expone a scrapers de forma innecesaria. 

La convención de seguridad de OFFSZN dicta que estas variables deben ser servidas dinámicamente desde el backend a través de la ruta `/env.js`, y consumidas agregando la etiqueta:

```html
<script src="/env.js"></script>
```

al principio de la sección `<head>`. Esto asegura que los entornos de desarrollo (Dev/Staging/Prod) carguen las claves correctas sin exponerlas estáticamente en el repositorio.

## Inyección DOM y Prevención de XSS

Cualquier contenido proporcionado por usuarios (como el nombre de un beat, el nickname de un artista o comentarios) que sea inyectado en el DOM a través de propiedades o métodos como `innerHTML` debe ser sanitizado previamente.

### Uso Obligatorio de `escapeHTML`
Cuando se creen componentes HTML de forma dinámica (ej. cards de productos en `favorites-manager.js` o listas), siempre envolver las variables dinámicas en la función `escapeHTML` (o similar si se utiliza otro framework de sanitización local).

```javascript
// Función estándar de sanitización
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

// Correcto:
const cleanName = escapeHTML(product.name);
card.innerHTML = `<h3>${cleanName}</h3>`;

// Incorrecto (Vulnerable a ataques de inyección):
// card.innerHTML = `<h3>${product.name}</h3>`;
```

Esta norma se aplica tanto a elementos visibles (texto en el DOM) como a constructores de atributos de datos (`data-artist='...'`), ya que injecciones en atributos de datos frecuentemente pueden forzar de escape a HTML pernicioso si abren comillas no cerradas adecuadamente.
