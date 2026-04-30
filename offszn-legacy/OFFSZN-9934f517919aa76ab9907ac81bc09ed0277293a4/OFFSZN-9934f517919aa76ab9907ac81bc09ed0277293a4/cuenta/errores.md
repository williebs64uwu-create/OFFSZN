# Registro de Errores y Resoluciones de Almacenamiento (R2)

Este documento detalla la auditoría y corrección masiva de activos (imágenes de productos) realizada el 31 de marzo de 2026.

## 1. Resumen Ejecutivo
Se detectó que más de 200 productos en la base de datos presentaban errores 404 (Not Found) o 403 (Forbidden) al cargar sus portadas. El problema no era la falta de archivos, sino una desincronización entre los metadatos de la base de datos y la ubicación física en los buckets de Cloudflare R2.

**Estado Actual:** ✅ Corregido. Todos los activos existentes han sido vinculados a su versión correcta de R2.

---

## 2. Diagnóstico: Patrones de Error

### Patrón A: Desincronización de Versiones (R2 v1 vs v2)
*   **Problema:** Productos almacenados en el bucket original (`offszn-storage` - V1) estaban marcados en la base de datos como `storage_version: 'v2'`. El servidor intentaba firmar las URLs con las credenciales del bucket nuevo, resultando en errores 403.
*   **Causa:** Durante la transición a R2 V2, algunos registros antiguos fueron actualizados erróneamente con la bandera de la nueva versión.
*   **Corrección:** Se auditó cada registro y se forzó la versión `v1` para los activos con rutas legadas.

### Patrón B: Contaminación de URLs Pre-firmadas
*   **Problema:** El campo `image_url` en la tabla `public.products` contenía URLs completas de AWS (con parámetros `?X-Amz-Algorithm...`) en lugar de rutas relativas limpias.
*   **Causa:** Ingestas de datos o procesos de carga que guardaron la URL temporal en lugar del nombre del archivo.
*   **Corrección:** Se ejecutó una limpieza SQL para extraer solo el nombre del archivo y eliminar los parámetros temporales.

### Patrón C: Datos de Prueba (Drafts)
*   **Problema:** Productos creados por el usuario `user2pr25` que no tenían archivos reales asociados (solo nombres).
*   **Corrección:** Eliminación de productos vinculados a usuarios de prueba sin contenido real.

---

## 3. Acciones Específicas Realizadas

### Auditoría Técnica
Se utilizaron scripts especializados (`audit_assets.mjs` y `verify_17.mjs`) para:
1. Listar el contenido físico de ambos buckets de R2.
2. Comparar cada fila de la base de datos contra la existencia real del archivo.
3. Identificar 20 casos críticos donde el activo usaba una carpeta moderna (`products/covers/`) pero residía en el bucket V2, mientras que el sistema lo buscaba en V1.

### Correcciones SQL (Supabase)
```sql
-- Ejemplo de limpieza de URLs contaminadas
UPDATE public.products 
SET image_url = split_part(image_url, '?', 1) 
WHERE image_url LIKE '%X-Amz-Algorithm%';

-- Corrección de versiones para el bucket V2
UPDATE public.products 
SET r2_version = 'v2', storage_version = 'v2' 
WHERE id IN (503, 470, 505, 498, 502, 487, 488, 501, 495, 494, 504, 482, 485, 500, 469, 486, 479, 499, 483, 463);
```

---

## 4. Activos Irrecuperables
Los siguientes archivos no fueron encontrados en ninguno de los dos buckets de R2. Es probable que fueran borrados manualmente o nunca se subieran correctamente durante las pruebas:
*   IDs detectados: `418, 497, 496, 451, 493, 87, 420, 455, 453`.

---

## 6. Optimización de Carga Masiva y Proxy Inteligente (Abril 2026)

Este apartado documenta la resolución de cuellos de botella críticos detectados al cargar perfiles de productores con alta densidad de productos (+50 filas).

### Problemas Detectados
1.  **Cuello de botella en Discovery Loop**: El proxy `/api/r2-public/` intentaba descubrir la versión (v1, v2, supabase) mediante `fetch` internos. Con 50 activos simultáneos, esto generaba cientos de peticiones internas, causando timeouts y errores 404/CORS falsos.
2.  **Conflicto de Observadores (Race Condition)**: `profile-public.js` y `r2-loader.js` (el observador global) intentaban autorizar la misma imagen. El observador reemplazaba la imagen cargada por un GIF transparente, sobrescribiendo el evento `onload` y dejando el "skeleton" gris pegado permanentemente.

### Soluciones Implementadas
*   **Version Hinting (`?v=`)**: Agregado parámetro de versión en la URL del proxy. Si se provee `?v=v1` o `?v=v2`, el servidor ignora la lógica de descubrimiento y redirige inmediatamente, reduciendo la latencia de 3.5s a milisegundos.
*   **Fast-Path Público**: El frontend ahora identifica activos públicos (covers, avatars, previews) y usa el proxy directamente sin encolar firmas innecesarias a Supabase.
*   **Desactivación de Gatillos Manuales**: Se eliminó `dataset.r2Src` en elementos cargados manualmente por scripts premium. Esto evita que `r2-loader.js` interfiera con cargas ya optimizadas.

---

## 7. Guía Técnica: Implementación de R2 Versión 3

Si decides añadir una **tercera cuenta de R2 (v3)**, el sistema ya está preparado para ser "consciente de versiones". Los pasos técnicos son:

### 1. Variables de Entorno (.env)
Añade las nuevas credenciales al servidor:
```env
R2_V3_ACCESS_KEY=tu_llave
R2_V3_SECRET_KEY=tu_secreto
R2_V3_BUCKET=nombre_bucket_v3
R2_V3_ENDPOINT=https://<id>.r2.cloudflarestorage.com
```

### 2. Configuración S3 (s3.config.js)
Inicializa el nuevo cliente en el backend:
```javascript
const s3v3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_V3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_V3_ACCESS_KEY,
        secretAccessKey: process.env.R2_V3_SECRET_KEY,
    },
});
// Exportar como s3Clients.v3
```

### 3. Proxy de Redirección (r2.routes.js)
Actualiza el "Short-Circuit" para soportar el hint de v3:
```javascript
if (v === 'v3') {
    return res.redirect(`${process.env.R2_V3_PUBLIC_URL}/${path}`);
}
```

### 4. Frontend (auth-utils.js)
El frontend ya es dinámico. Al llamar a `window.getAuthorizedUrl(path, 'v3')`, el sistema generará automáticamente la URL apuntando a la nueva cuenta sin cambios adicionales en la lógica de colas.

---
*Reporte actualizado por Antigravity (IA) - Abril 2026*
