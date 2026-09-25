# Error State Shake • OFFSZN UI Component

Transición física de sacudida y validación de error inspirada en Transitions.dev.

## Rutas
- CSS: `compon/new/error-state-shake/error-state-shake.css`
- JS: `compon/new/error-state-shake/error-state-shake.js`

## Comando rápido para Antigravity:
```
Usa el componente Error State Shake (compon/new/error-state-shake/) en [campo o formulario] cuando falle la validación.
```

## Uso rápido
```html
<link rel="stylesheet" href="/compon/new/error-state-shake/error-state-shake.css">

<!-- Modo Wrapper Completo -->
<div class="t-input-wrap" id="emailWrap">
  <div class="t-input">
    <input type="email" class="t-input-el" placeholder="tu@correo.com">
  </div>
  <p class="t-error-msg">Correo inválido</p>
</div>
```

```javascript
import { triggerInputShake } from '/compon/new/error-state-shake/error-state-shake.js';

// Activar error
triggerInputShake('#emailWrap', 'Por favor introduce un correo válido.');
```
