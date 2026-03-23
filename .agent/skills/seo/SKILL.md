---
name: seo-master
description: optimiza la visibilidad en buscadores mediante auditorías técnicas, análisis de contenido (E-E-A-T) y configuración de datos estructurados para OFFSZN.
---

# SEO Master para OFFSZN

## Cuándo usar este skill
- cuando se necesite auditar el SEO técnico de una página.
- cuando el usuario pida mejorar el posicionamiento de un producto o categoría.
- cuando haya que implementar Schema.org (datos estructurados).
- cuando se busque optimizar contenido para IA y buscadores modernos (GEO/AEO).
- cuando se compartan links y necesiten previsualizaciones premium (Open Graph).

## Inputs necesarios
- URL o Rápida descripción de la página a analizar.
- Objetivo específico (ej. "más clics", "mejor imagen en compartir", "indexación").

## Workflow
1) **Análisis Técnico**: Revisar etiquetas `<title>`, `<meta>`, encabezados `<h1>`-`<h6>` y velocidad de carga.
2) **Evaluación de Contenido**: Analizar calidad, relevancia y señales E-E-A-T (Experiencia, Autoridad, Confianza).
3) **Verificación de Compartido**: Validar tags `og:link`, `og:image` y Twitter Cards.
4) **Implementación de Schema**: Generar o corregir JSON-LD para productos, perfiles o artículos.
5) **Optimización GEO**: Ajustar el lenguaje y estructura para que IAs (Gemini, ChatGPT) entiendan mejor el contexto.

## Instrucciones

### 1. Auditoría Técnica
- Verifica que el `title` sea relevante y tenga menos de 60-70 caracteres.
- Asegúrate de que solo haya un `h1` por página.
- Revisa que las imágenes tengan el atributo `alt` descriptivo.

### 2. E-E-A-T (Experiencia, Pericia, Autoridad y Fiabilidad)
- Para productos: Mostrar el nombre del productor, fecha de creación y reviews (si hay).
- Para perfiles: Asegurar que la `bio` destaque la trayectoria del creador.

### 3. Schema.org (JSON-LD)
- Usa el formato `Product` para páginas de beats/kits.
- Usa el formato `Person` para perfiles de productores.
- Usa el formato `MusicGroup` o `MusicRecording` si aplica.

### 4. GEO (Generative Engine Optimization)
- Usa listas estructuradas y tablas para comparar precios o características.
- Mantén oraciones claras y directas que respondan preguntas del tipo "¿Cómo descargar beats en OFFSZN?".

## Output (formato exacto)
Devolver un reporte estructurado con:
- **Estado Actual**: <Puntaje 1-10>
- **Problemas Detectados**: <Lista de errores técnicos>
- **Mejoras Aplicadas**: <Cambios en código/etiquetas>
- **Código Generado (si aplica)**: <Bloque JSON-LD o HTML>

## Manejo de errores y correcciones
Si no puedes acceder a la URL, pide al usuario el contenido HTML de la página o usa `view_file` si es un archivo local. Si falta información de un producto, consulta la base de datos (Supabase) antes de inventar datos.
