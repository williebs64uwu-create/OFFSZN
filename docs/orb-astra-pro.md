# Orb · licencias y Astra en la nube (Pro / Max)

Rama: `feat/orb-astra-pro` (sin commits ni despliegue todavía).

## Qué cambia
- **Orb como producto**: `server/src/shared/config/pluginRegistry.js` → `{ id: 'orb', prefix: 'ORB' … }`. Seriales `ORB-(FULL|TRIAL|SUB)-…`, prueba de 3 días. Los endpoints existentes `/api/plugin/request-trial | activate | validate` ya funcionan para Orb.
- **Astra en la nube**: `server/src/infrastructure/http/controllers/AstraController.js` + `server/src/shared/astra/` (prompt, catálogo de parámetros de Orb y llamada al modelo).
  - `POST /api/plugin/astra/status` `{serial_key, hwid}` → plan (`local | trial | pro | max`), cupo y pedidos restantes.
  - `POST /api/plugin/astra` `{serial_key, hwid, text, current, history}` → valida licencia y equipo, descuenta el cupo de forma atómica, llama al modelo y devuelve cambios de parámetros + pedidos restantes.
  - `POST /api/plugin/admin/orb-tier` `{admin_key, serial_key, tier: pro|max|none, days}` → da o quita un plan a mano (la licencia debe tener `user_id`).
- **Planes**: se leen de `subscriptions` con `plan_id` que empiece por `orb_pro` u `orb_max` (por ejemplo `orb_pro_monthly`, `orb_max_yearly`), estado `active/canceled/trialing` y `current_period_end` futuro. La prueba de Orb da un cupo pequeño de la nube. Sin plan: solo Astra local (gratis, en el PC).
- **Limpiador de suscripciones**: las suscripciones `orb_*` vencidas se marcan `expired` **sin** bajar `users.plan` (antes cualquier vencimiento dejaba al usuario en `free` en el sitio).

## Para ponerlo en producción
1. Ejecutar en Supabase (SQL editor) `server/src/infrastructure/database/migrations/20261020_orb_astra_usage.sql`. Crea `astra_usage` (RLS activo, solo service role) y las funciones `consume_astra_quota`, `refund_astra_quota`, `record_astra_tokens`. Se adapta solo al tipo de `plugin_licenses.id` y se puede volver a ejecutar.
2. Variables de entorno del servidor:
   | Variable | Para qué | Por defecto |
   |---|---|---|
   | `ORB_LLM_API_KEY` | clave del proveedor del modelo (obligatoria para la nube) | — |
   | `ORB_LLM_BASE_URL` | API compatible con OpenAI (OpenRouter, Alibaba Model Studio…) | `https://openrouter.ai/api/v1` |
   | `ORB_PRO_MODEL` / `ORB_MAX_MODEL` / `ORB_TRIAL_MODEL` | modelo por plan | `qwen/qwen3-14b` / `qwen/qwen3-30b-a3b` / el de Pro |
   | `ORB_PRO_REQUESTS` / `ORB_MAX_REQUESTS` | pedidos al mes | 1000 / 3000 |
   | `ORB_TRIAL_REQUESTS` | pedidos de nube durante la prueba | 30 |
   | `ORB_PRODUCT_IDS` | IDs de producto de Orb en la tienda (coma) | — |
   Confirma los nombres exactos de los modelos en la web del proveedor antes de desplegar.
3. Cobro: crear los planes Orb Pro (5 US$/mes) y Orb Max (10 US$/mes) en PayPal y guardar la suscripción con `plan_id` `orb_pro_monthly` / `orb_max_monthly` (o `_yearly`). Mientras tanto se pueden dar a mano con `/api/plugin/admin/orb-tier`.
4. Desplegar el backend **antes** de distribuir Orb 0.2.0: sin la entrada `orb` en el registro, Orb no puede activarse.

## Pruebas
```
cd server
node --test --experimental-test-module-mocks tests/orb-astra.test.mjs        # 15 pruebas (Supabase y modelo simulados)
node --test --experimental-test-module-mocks tests/plugin-licensing.test.mjs # 19 pruebas existentes, siguen pasando
```
La migración se probó en Postgres real (PGlite) con `plugin_licenses.id` bigint y uuid. También se probó de punta a punta con el plugin Orb (build de prueba) contra estas rutas reales con una base en memoria: activación por clave y por prueba, cupo de prueba, Pro dado por administrador, pedidos a la nube y vuelta a Astra local al agotarse el cupo.
