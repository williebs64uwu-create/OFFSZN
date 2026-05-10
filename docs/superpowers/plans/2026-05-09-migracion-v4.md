# V4 Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Migrar el almacenamiento de archivos (R2) de V3 a un futuro bucket V4 de forma segura, garantizando la compatibilidad hacia atrás mediante Scavenger Probes y asegurando cero tiempos de inactividad durante la transición.
**Architecture:** Arquitectura Híbrida de Almacenamiento Distribuido (Scavenger Pattern) con resolución dinámica de buckets desde el backend, y hardcoding de nuevas escrituras a V4 en el frontend.
**Tech Stack:** Node.js (Backend), AWS SDK v3 para S3 (Cloudflare R2), Vanilla JS (Frontend), Supabase.
---

### Task 1: Configurar Credenciales y el Cliente S3 para V4

**Files:**
- Modify `server/.env`
- Modify `server/src/shared/config/config.js`
- Modify `server/src/infrastructure/services/r2-storage.service.js`

- [ ] **Step 1: Write the failing test**
*Nota: OFFSZN no tiene un entorno estricto de Jest configurado en el momento actual, pero la verificación se hará probando la inicialización del cliente.*

- [ ] **Step 2: Run test to verify it fails**
No aplica.

- [ ] **Step 3: Write minimal implementation**
1. Añadir las llaves de V4 al `.env`:
```env
R2_ENDPOINT_V4=https://<id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID_V4=<key>
R2_SECRET_ACCESS_KEY_V4=<secret>
R2_BUCKET_NAME_V4=bucket4lat
```
2. Modificar `config.js` para añadir las llaves y cambiar la versión actual:
```javascript
module.exports = {
    // ...
    R2_CURRENT_VERSION: process.env.R2_CURRENT_VERSION || 'v4', // CAMBIO PRINCIPAL
    R2_V4: {
        endpoint: process.env.R2_ENDPOINT_V4,
        accessKeyId: process.env.R2_ACCESS_KEY_ID_V4,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_V4,
        bucketName: process.env.R2_BUCKET_NAME_V4,
    }
}
```
3. En `r2-storage.service.js`, instanciar el cliente V4:
```javascript
const s3ClientV4 = new S3Client({
    region: 'auto',
    endpoint: config.R2_V4.endpoint,
    credentials: {
        accessKeyId: config.R2_V4.accessKeyId,
        secretAccessKey: config.R2_V4.secretAccessKey
    }
});
```

- [ ] **Step 4: Run test to verify it passes**
Ejecutar el backend y verificar que no hay errores de sintaxis o de inicialización del cliente S3.

- [ ] **Step 5: Commit**
`git commit -m "feat: setup V4 R2 credentials and client"`

---

### Task 2: Actualizar el Backend Router y Scavenger Logic

**Files:**
- Modify `server/src/infrastructure/services/r2-storage.service.js`
- Modify `server/src/infrastructure/http/routes/r2.routes.js`

- [ ] **Step 1: Write the failing test**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
1. En `r2-storage.service.js`, agregar V4 a `resolveScavengerKey`:
```javascript
async resolveScavengerKey(key) {
    // ...
    const clients = [
        { id: 'v4', client: s3ClientV4, bucket: config.R2_V4.bucketName },
        { id: 'v3', client: s3ClientV3, bucket: config.R2_V3.bucketName },
        { id: 'v2', client: s3ClientV2, bucket: config.R2_V2.bucketName },
        { id: 'v1', client: s3ClientV1, bucket: config.R2_V1.bucketName }
    ];
    // ...
}
```
2. Actualizar `getPublicUrl` para resolver dominios V4.
3. En `r2.routes.js`, actualizar el default fallback de subidas:
```javascript
const version = req.body.version || 'v4';
```

- [ ] **Step 4: Run test to verify it passes**
Intentar borrar un archivo desde postman sin especificar versión (`version: null`) y asegurar que el Scavenger pasa por V4 y luego V3.

- [ ] **Step 5: Commit**
`git commit -m "feat: update backend scavenger logic for V4 compatibility"`

---

### Task 3: Actualizar Subidas y Metadata en Frontend (Beats y Utils)

**Files:**
- Modify `upload/nuevo.js`
- Modify `upload/beats-yt.js`
- Modify `script/auth-utils.js`

- [ ] **Step 1: Write the failing test**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
1. En `nuevo.js` y `beats-yt.js`, buscar instancias de `'v3'` (ej. `storage_version: 'v3'`, `version: 'v3'`) y reemplazarlas por `'v4'`.
2. En `auth-utils.js`, en `uploadToR2`, cambiar el payload a:
```javascript
body: JSON.stringify({
    fileName: file.name || 'blob',
    fileType: file.type || 'application/octet-stream',
    folder: folder,
    fileSize: file.size,
    version: 'v4' // Always use v4 for new uploads
})
```

- [ ] **Step 4: Run test to verify it passes**
Subir un beat desde la web local. Verificar en la base de datos Supabase que las filas se crean con `r2_version: 'v4'`.

- [ ] **Step 5: Commit**
`git commit -m "feat: set V4 as default in frontend uploader scripts"`

---

### Task 4: Actualizar Productos Complejos (Drum Kits, Presets, Loop Kits, Producers)

**Files:**
- Modify `cuenta/Upload/Drum-Kits.html`
- Modify `cuenta/Upload/Loop-Kits.html`
- Modify `cuenta/Upload/Presets.html`
- Modify `script/producers.js`

- [ ] **Step 1: Write the failing test**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
1. En cada archivo HTML de la carpeta Upload, localizar los objetos `productData` o similares que tengan hardcodeado `storage_version: 'v3'` y `r2_version: 'v3'`. Actualizarlos a `'v4'`.
2. En `producers.js`, actualizar la subida de maquetas de `'v3'` a `'v4'`.

- [ ] **Step 4: Run test to verify it passes**
Probar cargar la página y confirmar en el Network Tab que el JSON mandado en la creación contiene `v4`.

- [ ] **Step 5: Commit**
`git commit -m "feat: update complex product uploaders to use V4"`

---

### Task 5: Validar Lógica de Borrado Dinámico (Cleanup)

**Files:**
- Verify `cuenta/mis-kits.html`
- Verify `script/auth-utils.js` (deleteFromR2)

- [ ] **Step 1: Write the failing test**

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
*Nota: Gracias al refactor hecho durante la transición a V3, este paso no debería requerir escribir código nuevo.*
1. Verificar que `mis-kits.html` agrupa dinámicamente usando `const v = obj.version || 'v1';`.
2. Asegurar que no existen sentencias "If/Else" duras en el frontend evaluando strings estáticos como "v2" o "v3".

- [ ] **Step 4: Run test to verify it passes**
Borrar un kit antiguo (V1 o V2) desde el Dashboard del Productor. La consola del servidor no debería arrojar errores.

- [ ] **Step 5: Commit**
`git commit -m "test: verify generic cleanup logic behaves correctly under V4"`
