---
name: esqueletos-pixel-perfect
description: diseña e implementa pantallas de carga (skeletons) que coinciden exactamente con la UI final, eliminando saltos visuales y siguiendo el estándar de calidad de Boneyard.
---

# Esqueletos Pixel-Perfect (Boneyard Methodology)

## Cuándo usar este skill
- cuando una página tenga un "pop-in" visual molesto al cargar.
- cuando el contenido real sea mayor o menor que el skeleton actual (Layout Shift).
- cuando el usuario quiera mejorar la percepción de velocidad (Perceived Performance).
- para implementar estados de carga "Netflix-style" ultra fluidos.

## Inputs necesarios
- **Componente Objetivo**: El selector CSS o código del componente real (ej: `.beat-card`).
- **Medidas Reales**: Dimensiones exactas de los elementos internos (imágenes, textos).
- **Entorno**: Si es una lista (grid) o un hero solitario.

## Workflow
1) **Snapshot de Dimensiones**: Analizar el CSS del componente real. Extraer `width`, `height`, `aspect-ratio` y `border-radius`.
2) **Mapeo de "Huesos" (Bones)**: Identificar los elementos clave:
    - *Media Bones*: Para imágenes y videos (usar `aspect-ratio`).
    - *Text Bones*: Para títulos y párrafos (usar 80% del ancho del contenedor para variabilidad).
    - *Action Bones*: Para botones y círculos de avatar.
3) **Generación de Estructura**: Crear un div contenedor con la clase `.skeleton-container` que replique el DOM del componente real pero con placeholders.
4) **Estilización Shimmer**: Aplicar el gradiente animado de OFFSZN (B&W) para indicar actividad.
5) **Sincronización de Revelado**: Implementar el "Atomic Reveal" (clase `.loaded` en el padre) para que el cambio sea instantáneo y sin parpadeos.

## Instrucciones
- **Fidelidad**: El esqueleto DEBE medir exactamente lo mismo que el componente real. Si la card mide 300px, el esqueleto mide 300px.
- **Color**: Usa `rgba(255, 255, 255, 0.05)` para el fondo base y `rgba(255, 255, 255, 0.1)` para el brillo del shimmer.
- **Bordes**: Los `border-radius` deben ser idénticos (ej: 16px en cards).
- **Tipografía**: Los bloques de texto del esqueleto deben tener una altura similar a la `line-height` real (ej: 14px-16px).

## Output (formato exacto)
1. **HTML**: Marcado del esqueleto.
2. **CSS**: Estilos específicos de posicionamiento y animación shimmer.
3. **JS Logic**: (Opcional) Lógica de transición para quitar el esqueleto suavemente.

## Manejo de errores y correcciones
- **Layout Shift**: Si al cargar el contenido la página "salta", significa que el esqueleto no tiene las medidas correctas. Revisa los `margins` y `paddings` del contenedor.
- **Parpadeo**: Si el esqueleto desaparece antes de que la imagen esté lista, usa el evento `onload` de la imagen para disparar la transición final.
