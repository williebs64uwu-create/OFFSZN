---
name: estrategia-contenido
description: analiza perfiles de instagram y tiktok para identificar patrones de éxito y realizar brainstorming de nuevas ideas virales.
---

# Estrategia de Contenido y Brainstorming

## Cuándo usar este skill
- cuando el usuario necesite nuevas ideas de contenido para Instagram, TikTok o YouTube Shorts.
- cuando el usuario quiera analizar métricas o patrones de éxito de sus contenidos previos.
- cuando se requiera adaptar el entorno actual o tendencias al estilo propio del creador.

## Inputs necesarios
- URLs de los perfiles (ej. Instagram: @willieinspired, TikTok: @willieinspired) o contexto de las últimas publicaciones.
- Objetivo específico (conseguir vistas, conversión, interacción, retención).
- (Opcional) Estadísticas recientes de los videos o publicaciones a evaluar.

## Workflow
1) **Contexto y Raspado Conceptual**: Leer los perfiles provistos. Analizar los ganchos (hooks), temáticas, formatos visuales y métricas de engagement visibles en los últimos posteos, solicitando al usuario que comparta capturas o provea datos si no hay acceso directo.
2) **Auditoría Express**: Identificar el "patrón ganador" (¿qué video tuvo más éxito últimamente y por qué?). Determinar qué adaptar o mejorar para aprovechar tendencias.
3) **Brainstorming Estructurado**: Proponer exactamente 3 a 5 ideas altamente refinadas. Cada idea debe incluir:
   - Gancho (primeros 3 segundos).
   - Formato (carrusel, reel, talking head).
   - Ángulo psicológico o por qué funcionará.
4) **Desarrollo (Hand-off)**: Una vez que el usuario apruebe una idea, expandirla en un guion estructurado o esqueleto de diseño, y sugerir pasar el trabajo a otras skills como `ig-carousel-generator` o `copywriting-premium`.

## Instrucciones
- **Prohibido el contenido genérico**: Evita ideas cliché de ChatGPT (ej. "5 tips para el éxito"). Debes adaptar las ideas a la estética y vibra existente en los perfiles provistos.
- **Foco en el Gancho**: El éxito depende de los primeros 1-3 segundos. Invierte la mayor parte del esfuerzo en pensar hooks dinámicos y controversiales o de alta retención.
- Si el agente no puede hacer web scraping directo (por barreras técnicas de la plataforma), debe solicitar al usuario que provea los títulos o capturas de pantalla de los últimos videos en lugar de fallar.
- Haz preguntas claras (una por vez) durante la fase de clarificación.
- Mantén el principio YAGNI para el contenido: si una idea requiere demasiada producción y el canal es rápido y sucio, descártala.

## Output (formato exacto)
Al iniciar el brainstorming, entrega este formato:

### Análisis Breve
- **Patrón Ganador Actual**: <breve descripción de lo que funciona>
- **Área de Oportunidad**: <qué se puede mejorar>

### Propuestas de Brainstorming
1. **[Formato] Idea 1**: <Gancho> - <Por qué funcionará>
2. **[Formato] Idea 2**: <Gancho> - <Por qué funcionará>
3. **[Formato] Idea 3**: <Gancho> - <Por qué funcionará>

## Manejo de errores y correcciones
Si las ideas propuestas no resuenan con el usuario o suenan demasiado robóticas, detente. Pide al usuario que defina el "tono" o que provea un ejemplo de un creador que admire en ese momento. Reajusta el brainstorming enfocando el 100% en imitar la estructura (no el contenido) de esa referencia.
