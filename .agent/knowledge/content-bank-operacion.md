# Content Bank: Operación (Canon)

Objetivo: reglas operativas para que el banco en Notion se mantenga limpio, dedupe, y listo para publicar desde el cel.

Fuentes
- Plan Notion Content Hub: [2026-05-24-notion-content-hub.md](file:///c:/Users/Willie/Desktop/OFFSZN/docs/superpowers/plans/2026-05-24-notion-content-hub.md)
- Panel de captions: [panel.html](file:///c:/Users/Willie/Desktop/OFFSZN/tools/content-bank/panel.html)
- Captions + performance logs: [content-bank-captions.md](file:///c:/Users/Willie/Desktop/OFFSZN/.agent/knowledge/content-bank-captions.md)

## Convención de nombre de archivo (Drive/exports)

Recomendada
- `YYYY-MM-DD__<hook-slug>+comenta-<keyword>.mp4`

Reglas
- `hook-slug`: minúsculas + guiones, sin tildes
- `keyword`: sin espacios (voces/plantilla/preset/2026)

## Schema mínimo en Notion (OFFSZN Content Bank)

Core
- Title
- Status: Draft | Listo para publicar | Publicado | Repost
- Plataformas: IG | TikTok
- Exported At
- Hook
- Keyword
- Drive Link
- Drive File ID

Copy
- Caption IG
- Hashtags IG
- Caption TikTok
- Hashtags TikTok

Métricas
- IG Views / Likes / Comments / Saves / Shares / Followers
- TT Views / Likes / Comments / Saves / Shares / Followers

Rates (formulas)
- IG Save Rate = IG Saves / IG Views
- IG Comment Rate = IG Comments / IG Views
- TT Save Rate = TT Saves / TT Views
- TT Comment Rate = TT Comments / TT Views

## Flujos (n8n)

Create (Drive → Notion)
- Detecta mp4 en carpeta sincronizada
- Extrae hook + keyword del filename
- Crea link compartible
- Crea registro en Notion con Drive File ID (para dedupe)

Update captions (HTML → Webhook → Notion)
- Panel manda keyword/captions/hashtags
- n8n busca registro target (modo simple: “último export”)
- n8n hace PATCH a la page de Notion con captions/hashtags

## Regla de trabajo (esta semana)

- Modo simple para evitar bugs: el webhook actualiza el último export (ordenado por Exported At desc).
- Dedupe por Drive File ID se activa cuando el Create flow esté estable y siempre guarde Drive File ID.

