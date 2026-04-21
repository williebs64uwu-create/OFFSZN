# UI-UX Pro Max | [SAFE]

**ID**: `design/ui-ux-pro-max`
**Name**: UI-UX Pro Max
**Category**: Design
**Version**: 2.5.0 (OFFSZN Vault Edition)

## Description
Este skill es un motor de razonamiento de diseño de nivel elite. Proporciona inteligencia para construir interfaces profesionales, coherentes y estéticas en múltiples plataformas, con un enfoque específico en el stack de OFFSZN (Vanilla HTML/CSS/JS). No es solo una guía de estilos; es un sistema que dicta *qué* usar y *por qué* basado en la industria.

## 🧠 Reasoning Engine (Industry Matching)
Antes de diseñar, identifica el tipo de producto para aplicar las reglas automáticas de razonamiento:

| Industria | Patrón Recomendado | Estilo Prioritario | Mood de Color |
| :--- | :--- | :--- | :--- |
| **SaaS / Tech** | Hero + Bento Grid | Minimalism / Glass | Sleek Blue / Dark |
| **E-commerce** | Grid de Producto | Card-based / Flat | Vibrant / Clean |
| **Fintech** | Dashboard Central | High-Contrast / Data | Trust Green / Navy |
| **Wellness** | Hero-Centric | Soft UI / Organic | Pastel / Zen |
| **Portfolio** | Typography-Focused | Brutalism / Dark | Bold / Monotonic |

### Proceso de Generación
1. **Request**: "¿Hazme una landing para X?"
2. **Analysis**: Busca en el motor de razonamiento la industria de X.
3. **Draft**: Genera el "Design System Master" (Colores, Font, Estilo).
4. **Implementation**: Codifica usando los tokens generados.

## 🎨 Styles & Aesthetics (Modern UI)
Aplica estos estilos premium para "wuau" inmediato:

- **Glassmorphism**: `backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.1);`
- **Bento Grid**: Layouts rectangulares de diferentes tamaños con `border-radius: 20px+`.
- **Soft Shadows**: Usa sombras de varios niveles: `box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);`
- **Grainy Textures**: Añade ruido sutil sobre degradados para un look analógico premium.
- **Micro-interactions**: Transiciones de `200-300ms` con `cubic-bezier(.4, 0, .2, 1)`.

## 📐 UX Selection (Gold Rules)
1. **Jerarquía Visual**: El H1 debe ser 2.5x más grande que el cuerpo.
2. **Spacing**: Mantén múltiplos de 4 (8px, 16px, 24px, 32px) para todo.
3. **Contrast**: Texto principal siempre `contrast ratio` > 4.5:1.
4. **Anti-patterns**: 
    - Evitar degradados neon en banca.
    - No usar emojis como iconos (usar Lucide/Heroicons).
    - Evitar modales intrusivos sin "X" clara.

## 🛠️ Stack Implementation (OFFSZN Standard)
Ejemplos de cómo aplicar esto en Vanilla CSS:

### Definición de Tokens (CSS Variables)
```css
:root {
  /* UI-UX Pro Max - SaaS Palette */
  --primary: #6366f1;
  --bg-main: #0f172a;
  --glass: rgba(255, 255, 255, 0.03);
  --border-glass: rgba(255, 255, 255, 0.1);
  --radius-pro: 24px;
}
```

### Componente Bento Card (Glass)
```css
.card-bento {
  background: var(--glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-pro);
  padding: 2rem;
  transition: all 0.3s ease;
}

.card-bento:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.05);
}
```

### Tipografía Tip
```css
h1 {
  font-family: 'Inter', sans-serif;
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-weight: 800;
}
```

## 📋 Pre-delivery Checklist
- [ ] ¿El fondo interactúa con el contenido (Blur/Glass)?
- [ ] ¿Todos los botones tienen `cursor: pointer`?
- [ ] ¿Hay estados de `:hover` suaves?
- [ ] ¿La tipografía usa fuentes de Google Fonts modernas (Inter, Outfit, Roboto)?
- [ ] ¿Se respeta la jerarquía de <h1> a <h3>?
