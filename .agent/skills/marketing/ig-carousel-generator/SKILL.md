---
name: ig-carousel-generator
description: Genera carruseles de Instagram premium (4:5) con sistema de diseño brandeado, narrativa estructurada y script de exportación automatizado.
---

# Instagram Carousel Generator

## Cuándo usar este skill
- Cuando el usuario quiera crear contenido de valor para Instagram en formato carrusel.
- Cuando se necesite un diseño premium que respete una identidad de marca específica.
- Cuando el objetivo sea exportar imágenes listas para publicar (1080x1350px).

## Inputs necesarios
1. **Brand Name**: Nombre de la marca.
2. **Handle**: @usuario de Instagram.
3. **Primary Color**: Color principal (Hex o descripción).
4. **Logo/Initial**: SVG, inicial o saltar.
5. **Topic**: Tema central del carrusel.
6. **Images**: (Opcional) Marcadores de posición o imágenes base64 para incluir.

## Workflow
1. **Recolección**: Confirmar los detalles de marca del usuario. Si falta algo, preguntar.
2. **Sistema de Color**: Derivar los 6 tokens (BRAND_PRIMARY, BRAND_LIGHT, BRAND_DARK, LIGHT_BG, DARK_BG, LIGHT_BORDER).
3. **Tipografía**: Seleccionar pareja de Google Fonts según el tono.
4. **Generación HTML**: Crear un archivo HTML único con todos los slides en un viewport 420x525 (ratio 4:5).
5. **Componentes**: Utilizar los componentes estandarizados (pills, quotes, list rows, numbered steps).
6. **Preview**: Mostrar el código HTML o una descripción visual detallada del preview.
7. **Exportación**: Generar el script de Python `export_slides.py` adaptado a los slides creados.

## Instrucciones de Diseño

### Escala de Tipografía
- **Headings**: 28-34px, weight 600, letter-spacing -0.5px.
- **Body**: 14px, weight 400, line-height 1.5.
- **Tags**: 10px, weight 600, uppercase, letter-spacing 2px.

### Estructura de Slides (4:5)
Cada slide debe incluir:
- **Progress Bar**: Barra en el fondo que se llena según el índice del slide.
- **Swipe Arrow**: Chevron a la derecha (excepto en el último slide).
- **Rítmica Visual**: Alternar fondos LIGHT_BG y DARK_BG.

### Secuencia Narrativa Estándar
1. **Slide 1 (Hero)**: Hook potente + Logo.
2. **Slide 2 (Problem)**: El dolor o lo que está mal.
3. **Slide 3 (Solution)**: El "secreto" o la gran solución (ej. OFFSZN).
4. **Slide 4 (Features)**: Lista de beneficios o características.
5. **Slide 5 (Details)**: Profundidad técnica o diferenciadores.
6. **Slide 6 (How-to)**: Pasos accionables (01, 02, 03).
7. **Slide 7 (CTA)**: Llamado a la acción claro + Logo final. (Sin flecha).

## Output (Formato Exacto)
Al usar el skill, debes entregar:
1. Una descripción del sistema de color y tipografía elegido.
2. El código **HTML completo** (CSS inline + JS para swiping/preview).
3. El script de **Python (Playwright)** para exportar los slides como PNGs de 1080x1350px.

## Manejo de errores y correcciones
- Si el usuario quiere cambiar un color, regenera todo el sistema de color basado en el nuevo input.
- Si las fuentes no cargan en el export, aumenta el `wait_for_timeout` en el script de Python.
- Asegúrate de que el contenido nunca pise la barra de progreso (padding inferior de 52px).
