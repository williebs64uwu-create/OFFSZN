---
name: estetica-premium-frontend
description: Senior UI/UX Engineer. Implementa interfaces premium de alta agencia, eliminando el "AI slop" genérico mediante reglas estrictas de tipografía, color, movimiento y densidad.
---

# Taste-Skill (High-Agency Frontend)

## Cuándo usar este skill
- Cuando necesites diseñar interfaces que se sientan "premium" y modernas.
- Cuando quieras evitar los diseños genéricos típicos de la IA (curvas suaves, colores lila/neón, layouts centrados).
- Cuando el usuario pida "mejor branding" o un look "editorial/minimalista".
- Al construir landing pages, dashboards o apps con alta interactividad (Framer Motion).

## Inputs necesarios
- **DESIGN_VARIANCE** (1-10): 1=Simetría perfecta, 10=Caos artístico/moderno.
- **MOTION_INTENSITY** (1-10): 1=Estático, 10=Física cinematográfica.
- **VISUAL_DENSITY** (1-10): 1=Galería aireada, 10=Panel de control denso.
- *Default: 8, 6, 4.*

## Workflow
1) **Calibración**: Ajustar los niveles de Variancia, Movimiento y Densidad según el requerimiento del usuario.
2) **Arquitectura**: Verificar dependencias (Tailwind, Framer Motion, Lucide) y estructurar componentes aislados.
3) **Filtro Anti-Slop**: Eliminar activamente sesgos de IA (No Inter font, no botones neón, no layout centrado por defecto).
4) **Ingeniería de Diseño**: Aplicar Tipografía determinística, Calibración de color (máx 1 acento) y Diversificación de layout.
5) **Interactividad Fractal**: Implementar estados de carga, vacíos, errores y feedback táctil (`scale-[0.98]`).

## Instrucciones

### 1. Sesgos a Eliminar (BANNED)
- **NO Inter Font**: Usa Geist, Outfit, Cabinet Grotesk o Satoshi.
- **NO "AI Purple"**: Prohibido el lila/neón. Usa bases neutras (Zinc/Slate) con un solo color de acento.
- **NO Layout Centrado**: Si la Variancia es > 4, usa layouts asimétricos o divididos (50/50).
- **NO Emojis**: Reemplázalos con Iconos de alta calidad (Phosphor, Radix) o SVG limpios.
- **NO Unsplash**: Usa `https://picsum.photos/seed/{string}/800/600` para placeholders reales.

### 2. Parámetros de Configuración
- **DESIGN_VARIANCE 8+**: Layouts asimétricos, Masonry grids, amplios espacios en blanco.
- **MOTION_INTENSITY 6+**: Micro-interacciones magnéticas, spring physics (`stiffness: 100, damping: 20`), loops infinitos suaves.
- **VISUAL_DENSITY 4-**: Galería de arte. Mucho aire. Fuentes grandes.

### 3. Principios de Código Premium
- **Viewport Safe**: Usa `min-h-[100dvh]` en lugar de `h-screen`.
- **Grid > Flex**: Usa CSS Grid (`grid-cols-X`) para estructuras fiables, nunca cálculos complejos de flexbox.
- **Hardware Acceleration**: Anima solo `transform` y `opacity`.
- **Liquid Glass**: 1px inner border (`border-white/10`) y sombra interna para refractar luz en modo glassmorphism.

### 4. Arquetipos de Componentes (Bento 2.0)
Al crear grids tipo Bento, aplica:
- `rounded-[2.5rem]` para contenedores grandes.
- Sombras de difusión amplias y transparentes.
- Labels de texto **fuera y debajo** de las tarjetas para un look de galería.

## Output (formato exacto)
El código debe ser extremadamente limpio, visualmente impactante y optimizado para 60fps. Si usas Next.js, aísla la interactividad en componentes con `'use client'`.

---

## Variantes Disponibles

### [Modo Brutalista]
- Tipografía masiva, bordes negros 2px, sombras sólidas sin blur, colores saturados/primarios.
- `DESIGN_VARIANCE: 10`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 8`.

### [Modo Minimalista Soft]
- Radios de 24px, sombras neutras muy suaves, tipografía ligera, transiciones sutiles.
- `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 2`.
