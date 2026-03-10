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

### Canvas Tainted y Manipulación de Imágenes (Cropper.js)

En funcionalidades como el **Avatar Manager** (`avatar-manager.js`), se cargan imágenes externas dentro de un `<canvas>` oculto para recortarlas usando librerías como `Cropper.js`. Si la imagen externa se carga **sin** el atributo `crossorigin="anonymous"`, el canvas se marcará como *tainted* (contaminado) por motivos de seguridad, y llamadas como `canvas.toDataURL()` fallarán.

Por lo tanto, SIEMPRE que se inyecten imágenes dinámicas desde Cloudinary o Cloudflare R2, la buena práctica en OFFSZN es asegurar que cuenten con `crossorigin="anonymous"`.
