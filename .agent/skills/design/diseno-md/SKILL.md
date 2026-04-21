---
name: diseno-md
description: diseña y escribe especificaciones de diseño en markdown siguiendo el estándar Stitch para asegurar coherencia visual absoluta y interfaces premium.
---

# Design MD: La Verdad del Diseño para IA

## Cuándo usar este skill
- cuando necesites definir un nuevo lenguaje visual para una página o feature.
- cuando quieras asegurar que Antigravity genere UI "Pixel-Perfect".
- cuando el usuario pida "un diseño premium" o "estilo B&W".
- para documentar tokens de diseño (colores, fuentes, sombras) de forma que la IA los use siempre.

## Inputs necesarios
- **Referencia Visual**: (Opcional) Una URL o descripción de un sitio (ej: "estilo Stripe", "Vercel minimalism").
- **Paleta de Colores**: Colores principales y de acento.
- **Atmósfera**: (Vibrante, Dark, Editorial, Minimalista).

## Workflow
1) **Definición de Tokens**: Identificar los 9 pilares del diseño (Theme, Colors, Typography, Components, Layout, Depth, Do's/Don'ts, Responsive, Agent Prompt).
2) **Selección de Estética**: Por defecto, usar el estándar **OFFSZN Deep Dark** (B&W) si el usuario no especifica lo contrario.
3) **Estructuración**: Generar el archivo `DESIGN.md` en la raíz del proyecto o módulo.
4) **Validation**: Verificar que los contrastes sean accesibles y la tipografía sea legible.

## Instrucciones
- **Fidelidad**: No inventes colores si ya existe un `DESIGN.md`. Lee el archivo antes de generar cualquier HTML/CSS.
- **Densidad**: Define si la interfaz debe ser compacta (SaaS dashboard) o espaciada (Landing page).
- **Tipografía**: Prioriza fuentes modernas de Google Fonts: *Inter*, *Plus Jakarta Sans*, o *Outfit*.
- **Sombras**: Evita bordes negros puros; usa elevación con sombras suaves y sutiles (Glows en Dark Mode).

## Output (formato exacto)
Un archivo `DESIGN.md` estructurado con:
1. Visual Theme
2. Color Palette
3. Typography Rules
4. Component Stylings
5. Layout Principles
6. Depth & Elevation
7. Do's and Don'ts
8. Responsive Behavior
9. Agent Prompt Guide (Resumen rápido para la IA)

## Manejo de errores y correcciones
- Si el diseño generado se ve "genérico", revisa la sección 4 (Components) y añade más detalle sobre radios de borde (border-radius) y efectos de hover.
- Si el usuario pide cambiar el estilo global, actualiza el `DESIGN.md` y luego pide al agente que "refactorice basándose en el nuevo sistema".
