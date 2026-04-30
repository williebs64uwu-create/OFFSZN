# PRD: OFFSZN Wrapped - Sistema de Marketing n8n + Resend

**Fecha**: 2026-04-22
**Estado**: Diseño / Brainstorming
**Autor**: Antigravity + Willie

## 1. Objetivo
Aumentar la retención y conversión de usuarios activos en OFFSZN mediante un resumen mensual personalizado que destaque sus logros y los incentive a mejorar su plan o actividad en la plataforma.

## 2. Audiencia (Filtro de Actividad)
Para optimizar recursos y asegurar relevancia, el email solo se enviará a:
- **Criterio**: Usuarios que hayan subido al menos **1 producto** en el mes natural anterior.
- **Exclusión**: Usuarios con 0 actividad de subida (para evitar spam a cuentas inactivas).

## 3. Segmentación y Métricas

### 3.1 Perfil: Productor
| Métrica | Fuente de Datos (Supabase) |
| :--- | :--- |
| Beats Subidos | Tabla `beats` (count por mes) |
| Videos YT Generados | Tabla `youtube_uploads` o logs |
| Likes Recibidos | Tabla `likes` (sum en sus productos) |
| Seguidores Ganados | Tabla `follows` (count por mes) |
| Ventas Realizadas | Tabla `sales` o `orders` |

**Recomendación Dinámica**:
- "Tus seguidores amaron tu producto **[Nombre del Beat más liked]**, ¡prueba subiendo similares este mes!"

---

### 3.2 Perfil: Artista
| Métrica | Fuente de Datos (Supabase) |
| :--- | :--- |
| Vistas a Perfil | Tabla `profile_views` o logs |
| Seguidores | Tabla `follows` |
| Productos Descargados | Tabla `downloads` |

**Recomendación Dinámica**:
- "Sube tu catálogo de artista para obtener más vistas en redes." (Feature futura).

---

## 4. Diferenciación por Plan (STARTER vs PRO)
- **STARTER**: Reporte simplificado con métricas básicas. CTA fuerte para "UPGRADE TO PRO".
- **PRO**: Reporte detallado, visualmente más premium, comparativas de crecimiento vs el mes anterior.

## 5. Diseño del Email (Layout)
1. **Header**: Logo OFFSZN.LAT + "Tu Mes en Resumen".
2. **Hero Section**: Nombre del usuario + Plan Actual.
3. **Métricas Grid**: Bloques estéticos con los números clave.
4. **Insight Box**: La recomendación personalizada de "Willie/IA".
5. **Offer Banner**: "Obtén PLAN PRO durante 6 meses por $20" (Botón: Obtener Oferta).
6. **Footer**: Redes sociales + Equipo de OFFSZN.LAT.

## 6. Flujo Técnico en n8n
1. **Cron Trigger**: 1ero de cada mes (09:00 AM).
2. **Supabase - Get Active Users**: Consulta SQL para filtrar los que subieron productos el mes pasado.
3. **Loop - Processing**:
    - Consultar métricas específicas para el usuario actual.
    - Evaluar si es Productor o Artista.
    - Generar el HTML personalizado (usando templates de Resend).
4. **Resend Node**: Envío masivo segmentado.

## 7. Notas de Implementación
- El botón de "Obtener Oferta" se configurará con un link temporal hasta que el sistema de pagos esté listo.
- Región de Resend: Sao Paulo (sa-1).
- Dominio verificado en Cloudflare: offszn.lat (o el configurado).
