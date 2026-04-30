# V2 Storage Sync & CORB Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Reparar los errores de carga ("404 Bad Request" y "CORB blocked response") en `explore.js` y `product-core.js` que no consiguen la imagen correcta por ser ingresadas a DB forzosamente como supabase.
**Architecture:** Frontend destructuring Payload -> Express Controller -> Supabase DB `products` table -> Frontend Read `explore.js` -> `auth-utils.js` (R2 resolver).
**Tech Stack:** JavaScript Vanilla (Frontend), Express.js (Backend Node)

---

### Task 1: Fix ProductController Defaults

**Files:**
- Modify `server/src/infrastructure/http/controllers/ProductController.js`

- [ ] **Step 1: Write the failing test**
N/A (API Handler unit testing over network)

- [ ] **Step 2: Run test to verify it fails**
N/A

- [ ] **Step 3: Write minimal implementation**
Añadir la deconstrucción de `storage_version` en `req.body` y fallback para `storage_version` al crear o editar (en vez del hardcode destructivo actual).
```javascript
            release_date,
            visibility,
            status,
            storage_version // [AÑADIR] Deconstruir storage_version
```
Y donde dice `storage_version: 'supabase'`:
```javascript
            r2_version: r2_version || 'v1',
            storage_version: storage_version || 'v2', // [CAMBIO] Dejar que prevalezca 'v2' o el input de nuevo.js
```

- [ ] **Step 4: Run test to verify it passes**
N/A

- [ ] **Step 5: Commit**
`git commit -m "fix(backend): read storage_version from body to enforce v2 correctly for R2 assets"`

---

### Task 2: Inject Explicit storage_version from nuevo.js

**Files:**
- Modify `upload/nuevo.js`

- [ ] **Step 1: Write the failing test**
N/A 

- [ ] **Step 2: Run test to verify it fails**
N/A

- [ ] **Step 3: Write minimal implementation**
Alrededor de la línea 1840 de `nuevo.js` donde se construye el payload `const finalData`:
```javascript
            wav_url,
            stems_url,
            r2_version: 'v2',
            storage_version: 'v2', // [AÑADIR] Fuerza que la base de datos no asuma supabase
```

- [ ] **Step 4: Run test to verify it passes**
N/A

- [ ] **Step 5: Commit**
`git commit -m "fix(upload): explicit v2 storage param injection to avoid supabase defaults"`

---

### Task 3: Fix double products prefix in initialSrc fallback

**Files:**
- Modify `script/explore.js` y `script/product-core.js`

- [ ] **Step 1: Write the failing test**
N/A

- [ ] **Step 2: Run test to verify it fails**
N/A

- [ ] **Step 3: Write minimal implementation**
Si algún producto viejo sigue como 'supabase' pero tiene rutado `products/covers/...`, remover la colisión de concatenado previniendo `products/products`.
```javascript
    // Explore.js (~15 líneas modificadas)
    if (!isR2 && !rawImg.startsWith('http')) {
        const sbUrl = window.SUPABASE_URL || "https://qtjpvztpgfymjhhpoouq.supabase.co";
        if (!rawImg.includes('supabase.co')) {
            // Eliminar `products/` que se autoduplicaba.
            // Opcionalmente parsear rawImg si la ruta local no requiere su doblete.
            let cleanImg = rawImg.startsWith('products/') ? rawImg.substring(9) : rawImg;
            initialSrc = `${sbUrl}/storage/v1/object/public/products/${cleanImg}`;
        }
    }
```
Aplicar el mismo saneamiento lógico en `product-core.js` en caso de fallo de Supabase predeterminado.

- [ ] **Step 4: Run test to verify it passes**
N/A

- [ ] **Step 5: Commit**
`git commit -m "fix(frontend): strip initial products/ from raw relative path when crafting supabase raw url"`
