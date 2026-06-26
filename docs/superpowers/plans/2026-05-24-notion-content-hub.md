# Notion Content Hub (Exports → Drive → Notion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar el flujo CapCut PC → Google Drive → Notion para tener un “banco” de videos, captions y métricas con links listos para publicar desde el celular.

**Architecture:** Google Drive actúa como “bus” (trigger cloud). n8n detecta nuevos MP4 en una carpeta sincronizada, crea link compartible, crea un registro en Notion y permite luego adjuntar captions y métricas (manual o por webhook).

**Tech Stack:** Google Drive (Drive for desktop), Notion DB, n8n (Render), Webhooks n8n.

---

## Contexto (Inputs confirmados)
- Carpeta local export CapCut (Windows): `D:\!REDES\EXPORTADOS` (sincronizada con Google Drive Desktop).
- n8n: `https://offszn-n8n.onrender.com/`.
- Cuenta Google/Drive: `williebeatsyt@gmail.com`.
- Convención actual de nombre (mínimo): `voz-sin-cuerpo+comenta-voces.mp4`.

---

## Decisiones de Diseño (para fechas, orden y “importancia”)

### 1) Convención de nombre (recomendada)
Mantener tu formato pero con fecha al inicio para orden y dedupe:

`YYYY-MM-DD__<hook-slug>+comenta-<keyword>.mp4`

Ejemplo:
`2026-05-24__voz-sin-cuerpo+comenta-voces.mp4`

Reglas:
- `hook-slug`: minúsculas + guiones.
- `keyword`: sin espacios (ej: `voces`, `plantilla`, `preset`).

### 2) Estados
- `Draft` → `Listo para publicar` → `Publicado` → `Repost`

### 3) Importancia (prioridad)
Propiedad `Prioridad` con opciones:
- `Alta` (publicar hoy / repost urgente)
- `Media` (esta semana)
- `Baja` (backlog)

### 4) Métricas mínimas por plataforma
- Instagram: `Views`, `Likes`, `Comments`, `Saves`, `Shares`, `Followers Gained`
- TikTok: `Views`, `Likes`, `Comments`, `Saves`, `Shares` (opcional si lo trackeas), `Followers Gained`

### 5) Validaciones automáticas (en n8n)
- Solo procesar archivos `.mp4`.
- Ignorar archivos que no cumplan nombre mínimo (contengan `+comenta-`).
- Dedupe por `Drive fileId` (guardar `Drive File ID` en Notion y buscar antes de crear).

---

## Estructura en Notion (DB única)

### Database: `OFFSZN Content Bank`

**Propiedades (schema)**
- `Title` (title): nombre legible (ej: `voz sin cuerpo`)
- `Status` (select): Draft | Listo para publicar | Publicado | Repost
- `Plataformas` (multi-select): IG | TikTok
- `Exported At` (date): fecha/hora detectada desde Drive
- `Planned Publish` (date): fecha/hora objetivo (tu calendario)
- `Prioridad` (select): Alta | Media | Baja
- `Keyword` (select o text): `voces` / `plantilla` / `preset`
- `Hook` (text): `voz-sin-cuerpo`
- `Drive Link` (url): link compartible del mp4
- `Drive File ID` (text): para dedupe
- `Caption IG` (text)
- `Caption TikTok` (text)
- `Hashtags IG` (text)
- `Hashtags TikTok` (text)
- `IG Views` (number), `IG Likes` (number), `IG Comments` (number), `IG Saves` (number), `IG Shares` (number), `IG Followers` (number)
- `TT Views` (number), `TT Likes` (number), `TT Comments` (number), `TT Saves` (number), `TT Shares` (number), `TT Followers` (number)
- `Audios Recibidos` (number): Cantidad de leads que enviaron su toma para prueba
- `Demos Enviados` (number): Previews personalizados entregados por DM
- `Ventas Directas` (number): Cash collected rastreable mediante el post

**Fórmulas (Notion)**
- `IG Save Rate` (formula):
  - `if(prop("IG Views") > 0, prop("IG Saves") / prop("IG Views"), 0)`
- `IG Comment Rate` (formula):
  - `if(prop("IG Views") > 0, prop("IG Comments") / prop("IG Views"), 0)`
- `TT Save Rate` (formula):
  - `if(prop("TT Views") > 0, prop("TT Saves") / prop("TT Views"), 0)`
- `TT Comment Rate` (formula):
  - `if(prop("TT Views") > 0, prop("TT Comments") / prop("TT Views"), 0)`
- `Conversión Demo Rate` (formula):
  - `if(prop("IG Views") > 0, prop("Audios Recibidos") / prop("IG Views"), 0)`
- `Cierre Ventas Rate` (formula):
  - `if(prop("Audios Recibidos") > 0, prop("Ventas Directas") / prop("Audios Recibidos"), 0)`

**Views recomendadas**
- `READY TO POST`: Status = `Listo para publicar` ordenado por `Planned Publish` asc.
- `POSTED`: Status = `Publicado` ordenado por `Exported At` desc.
- `REPOST CANDIDATES`: Status != `Publicado` y `Prioridad` = Alta.

---

## Plan de Ejecución de Tareas (Atomic Tasks)

### Task 1: Crear Notion Workspace mínimo + DB `OFFSZN Content Bank`

**Files:**
- Docs: `docs/willieinspired_brand_logic.md` (referencia de métricas y benchmarks ya existente)
- Nuevo (opcional): `docs/content-bank/README.md` (solo si queremos documentar el flujo)

- [ ] **Step 1: Crear cuenta Notion + página raíz `OFFSZN`**
- [ ] **Step 2: Crear database `OFFSZN Content Bank` con el schema listado**
- [ ] **Step 3: Crear las 3 views (READY TO POST / POSTED / REPOST CANDIDATES)**
- [ ] **Step 4: Crear templates de página**
  - Template `IG + TikTok`: secciones “Hook”, “Caption IG”, “Caption TikTok”, “Métricas”

---

### Task 2: Crear integración Notion + conexión en n8n

- [ ] **Step 1: Crear Notion Integration (Internal Integration)**
  - Permisos: Read/Write sobre la database.
- [ ] **Step 2: Compartir la database con la Integration**
- [ ] **Step 3: Guardar en n8n (credentials)**
  - `NOTION_TOKEN`
  - `NOTION_DATABASE_ID`

---

### Task 3: Flujo n8n #1 — “New MP4 in Drive → Create Notion record”

**Inputs:**
- Folder Drive: equivalente cloud de `D:\!REDES\EXPORTADOS` (la carpeta sincronizada).

- [ ] **Step 1: Crear trigger Drive “New file in folder”**
- [ ] **Step 2: Filtro**
  - `mimeType` compatible video o `name endsWith .mp4`
  - `name contains "+comenta-"`
- [ ] **Step 3: Parser de filename**
  - Extraer:
    - `date` si existe `YYYY-MM-DD__`
    - `hook` antes de `+comenta-`
    - `keyword` después de `+comenta-` y antes de `.mp4`
- [ ] **Step 4: Dedupe**
  - Buscar en Notion por `Drive File ID`
  - Si existe: terminar
- [ ] **Step 5: Crear link compartible en Drive**
  - Permiso: “anyone with link can view”
  - Guardar `webViewLink`
- [ ] **Step 6: Crear registro en Notion**
  - `Title`: `hook` (con espacios, reemplazando guiones por espacios)
  - `Status`: `Listo para publicar`
  - `Exported At`: `createdTime` del archivo en Drive
  - `Hook`, `Keyword`, `Drive Link`, `Drive File ID`
  - `Plataformas`: IG + TikTok (default)
  - `Planned Publish`: vacío (se decide luego) o default “hoy 18:00” si quieres automatizarlo

---

### Task 4: Flujo n8n #2 — “Guardar captions/hashtags al último export”

**Objetivo:** evitar mandarte captions por WhatsApp y tenerlos listos para copiar desde el cel.

- [ ] **Step 1: Webhook (POST)**
  - Body esperado:

```json
{
  "driveFileId": "string (opcional)",
  "hook": "string (opcional)",
  "captionIG": "string",
  "hashtagsIG": "string",
  "captionTT": "string",
  "hashtagsTT": "string",
  "keyword": "VOCES"
}
```

- [ ] **Step 2: Resolver “target record”**
  - Si viene `driveFileId`: buscar por `Drive File ID`
  - Si no viene: buscar último registro con `Status = Listo para publicar` ordenado por `Exported At` desc
- [ ] **Step 3: Update en Notion**
  - `Caption IG`, `Hashtags IG`, `Caption TikTok`, `Hashtags TikTok`, `Keyword`

---

### Task 5 (Opcional): Mini panel local (HTML) con botones

**Goal:** desde PC, pegar captions y enviar con 1 click a n8n.

**Files:**
- Create: `tools/content-bank/panel.html`

- [ ] **Step 1: Crear `panel.html` con inputs**
  - Caption IG / TT
  - Hashtags IG / TT
  - Keyword
  - Botón “Enviar a Notion” (POST al webhook n8n)
- [ ] **Step 2: Guardar endpoint webhook en variable al inicio del archivo**
- [ ] **Step 3: Validación UI mínima**
  - No enviar si captions están vacíos

---

## Verificación (qué validar para decir “ya quedó”)
- Exportar un MP4 a `D:\!REDES\EXPORTADOS` y confirmar:
  - Aparece en Drive.
  - n8n crea 1 registro en Notion con link reproducible.
  - No crea duplicados si el trigger se repite.
- Ejecutar webhook de captions y confirmar:
  - Se actualiza el registro correcto.
  - Desde el celular puedes abrir Notion y copiar captions rápido.

---

## Ejecución
- Opción 1: Implementar solo **Task 1–4** (sin panel) para validar el flujo end-to-end.
- Opción 2: Luego sumar **Task 5** para “botón enviar” desde PC.

