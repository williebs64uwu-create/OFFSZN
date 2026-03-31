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

## 5. Recomendaciones para el Futuro (R2 Versión 3)

Si decides implementar una **R2 V3**, sigue estas reglas de oro para evitar que esto vuelva a pasar:

1.  **Migración Única:** No mantengas 3 buckets activos. Lo ideal es mover todo lo de V1 y V2 al bucket de V3 y actualizar TODA la base de datos a `v3`.
2.  **Rutas Normalizadas:** Nunca guardes `http://...` en la base de datos. Guarda siempre la ruta relativa (ej: `products/covers/imagen.jpg`).
3.  **Script de Verificación:** Antes de lanzar, corre un script de "Integridad de Portadas" que avise si existe alguna fila en la DB cuyo archivo no esté en R2.
4.  **Configuración Centralizada:** Mantén las versiones en una sola tabla de configuración o variable de entorno, evitando que cada producto tenga que "adivinar" su versión si es posible.

---
*Reporte generado por Antigravity (IA).*
