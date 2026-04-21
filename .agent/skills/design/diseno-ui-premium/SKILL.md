---
name: diseno-ui-premium
description: diseña e implementa interfaces frontend llamativas y de alta calidad, evitando estilos genéricos y respetando la marca del proyecto.
---

# Diseño UI Premium

## Cuándo usar este skill
- cuando se necesita construir un componente, página o aplicación frontend desde cero o rediseñarlo.
- cuando el usuario pide evitar diseños genéricos, aburridos o tipo "plantilla de IA básica".
- cuando se requiere un trabajo de alto impacto visual y precisión estética adaptado a la marca.

## Inputs necesarios
1. Requerimientos del frontend: componente, página o interfaz a construir.
2. Contexto: propósito del diseño, audiencia y restricciones técnicas (framework, Tailwind, CSS puro, rendimiento).
3. Branding/Marca del proyecto (colores, tonos, directrices principales si ya existen en el proyecto).

## Workflow
1) **Design Thinking (Plan)**: Entender el propósito, elegir un tono audaz (minimalista, brutalista, retro-futurista, elegante, etc.) y definir qué lo hará inconfundible.
2) **Evaluación de Restricciones**: Revisar el stack tecnológico especificado y nivelar la complejidad vs la visión estética.
3) **Ejecución de Diseño (Código)**: Implementar código funcional integrando tipografías con carácter, cohesión de color (variables) y composición espacial (espaciado dinámico, asimetría).
4) **Micro-interacciones y Detalles**: Añadir animaciones de alto impacto y detalles de fondo/texturas adecuadas al estilo escogido.
5) **Validación Anti-Slop**: Revisar exhaustivamente que el diseño NO use las típicas fuentes (Inter, Roboto, Arial), layouts predecibles o los colores clichés (como degradados morados genéricos).

## Instrucciones

- **Tipografía**: NUNCA uses fuentes genéricas por defecto. Combina una fuente display/título distintiva con una fuente de cuerpo refinada. Si usas Google Fonts, busca rarezas o carácter.
- **Color y Tema**: Comprométete con una estética cohesiva. Usa variables CSS para consistencia. Emplea acentos agresivos o elegantes en lugar de paletas tímidas y distribuidas uniformemente.
- **Movimiento**: Usa animaciones CSS para efectos y micro-interacciones. Prioriza revelaciones escalonadas de alto impacto visual en la carga de página en lugar de saturar con pequeñas animaciones. Usa desencadenadores scroll y estados *hover* que sorprendan.
- **Composición Espacial**: Promueve layouts inesperados. Explora la asimetría, flujos diagonales, elementos que rompan la cuadrícula y un espacio negativo muy generoso o densidad milimétricamente controlada.
- **Fondos y Visuales**: Crea atmósfera y profundidad. Agrega texturas (grano, ruido, mallas de degradado), sombras dramáticas, cursores personalizados o bordes decorativos según el ADN de la marca.
- **Prohibido el cliché ("AI slop")**: Cada diseño debe tener personalidad. Varía entre temas claros/oscuros y no converjas en elecciones estéticas comunes entre generaciones sucesivas de código.
- Escala la complejidad de la implementación a la visión estética: un diseño maximalista requiere código expansivo con efectos extensos, mientra que un diseño minimalista exige precisión absoluta en espaciados y tipografía sutil.

## Output (formato exacto)
Devuelve siempre al finalizar la generación:
1) **Visión del Diseño**: Resumen muy corto del concepto estético elegido (Tone, Differentiation).
2) **Código Implementado**: Código frontend funcional y de alta calidad técnica (HTML/CSS/JS, componente React, etc.) implementado según la marca.
3) **Guía de Estilo Aplicada**: Referencia rápida de los colores primarios, tipografías y texturas que se usaron en el código resultante.

## Manejo de errores y correcciones
Si el usuario indica que el resultado se ve "muy aburrido", "de plantilla" o "con estilo de IA", vuelve inmediatamente a la fase de Design Thinking. Cambia radicalmente la paleta de colores o el peso tipográfico, remueve cualquier elemento simétrico simple e implementa una composición disruptiva con interacciones fuertes, preguntando antes si le parece bien esa nueva dirección.
