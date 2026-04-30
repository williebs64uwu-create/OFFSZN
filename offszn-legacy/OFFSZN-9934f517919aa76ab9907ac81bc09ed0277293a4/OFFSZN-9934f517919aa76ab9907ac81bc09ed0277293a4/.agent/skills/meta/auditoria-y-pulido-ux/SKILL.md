---
name: auditoria-y-pulido-ux
description: Experto en calidad y pulido de interfaces. Audita, normaliza y destila diseños para alcanzar un grado de producción impecable, eliminando patrones de IA flojos y asegurando perfección visual.
---

# Auditoría y Pulido UX (Impeccable Design)

## Cuándo usar este skill
- Cuando necesites revisar una interfaz existente para elevar su calidad profesional.
- Para eliminar el "AI slop" que no cubrió la skill de estética (ej. bordes laterales, texto con gradiente).
- Antes de pasar a producción ("ship it").
- Cuando el usuario use comandos como `/audit`, `/polish` o `/distill`.

## Inputs necesarios
- **Contexto de Diseño** (puedes leer `.impeccable.md` si existe):
  - Público objetivo.
  - Casos de uso.
  - Personalidad de marca (3 palabras concretas, no "clichés").

## Workflow (Comandos)
1) **teach**: Gana contexto explorando el código y haciendo 3 preguntas de negocio/marca.
2) **audit**: Evalúa la UI actual y genera un reporte de problemas sin editar código.
3) **polish**: Realiza el pase final de limpieza (espacios, contraste, refinamiento).
4) **normalize**: Alinea el código con el sistema de diseño del proyecto.
5) **distill**: Elimina complejidad innecesaria y visual noise.

## Instrucciones y Reglas "Impeccable"

### 1. Tipografía Determinística (Anti-Monocultura)
- **Prohibido el Reflejo**: Rechaza fuentes por defecto (`Inter`, `Roboto`, `Arial`) y sus "segundas opciones" comunes (`Lora`, `Syne`, `Outfit`, `Plus Jakarta Sans`).
- **Procedimiento**: Define la voz de marca en 3 palabras reales (ej. "mecánico, ruidoso, honesto"). Busca una fuente que se sienta como un "objeto físico" (ej. un manual de 1970, un cartel pintado a mano).
- **Escala**: Usa escalas modulares con contraste (ratio 1.25+).

### 2. Color y Contraste Profesional
- **OKLCH Obligatorio**: Usa `oklch()` para una luminosidad uniforme. Reduce el chroma (> luminosidad = < chroma).
- **Prohibido el Negro/Blanco Puro**: Nunca uses `#000` o `#fff`. Tinta siempre los neutros con el color de marca (chroma 0.005-0.01).
- **Regla 60-30-10**: 60% superficies neutras, 30% bordes/secundario, 10% acento.

### 3. Diseño Espacial
- **Escala de 4pt**: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Gap > Margins**: Usa `gap` en Flex/Grid para evitar colapsos de margen.
- **Ritmo Visual**: No uses el mismo padding en todas partes. Varía el espacio para crear flujo.

### 4. Prohibiciones Absolutas (AI Slop Tells)
- **BAN 1**: Bordes laterales gruesos en tarjetas (`border-left > 1px`). Es el signo más común de diseño de dashboard barato.
- **BAN 2**: Texto con gradiente (`background-clip: text`). Es decorativo, no legible. Usa colores sólidos.
- **BAN 3**: Cards dentro de cards. Aplana la jerarquía usando espacios o líneas de 1px.
- **BAN 4**: Centrar todo. El alineado a la izquierda con layouts asimétricos se siente más profesional.

## Output (formato exacto)
Al recibir un comando (ej. `/audit`), el primer paso es listar los hallazgos. Al ejecutar `/polish` o `/normalize`, el código resultante debe ser de grado de producción, sin bordes laterales, con tipografía única y espacios matemáticamente rítmicos.

---

## Comandos Rápidos
- **/audit [feature]**: Reporte de calidad.
- **/polish [feature]**: Limpieza final.
- **/distill**: Simplificación de UI.
- **/typeset**: Refinamiento tipográfico.
