# Success Check • OFFSZN UI Component

Animación fluida de éxito con 5 efectos en paralelo: opacidad suave, rotación (80deg a 0deg), desenfoque óptico (10px a 0), rebote vertical (40px a 0) y trazado dinámico de vector SVG.

## Rutas
- CSS: `compon/new/success-check/success-check.css`
- JS: `compon/new/success-check/success-check.js`

## Comando rápido para Antigravity:
```
Usa el componente Success Check (compon/new/success-check/) en [modal de pago / toast / confirmación].
```

## Uso rápido
```html
<link rel="stylesheet" href="/compon/new/success-check/success-check.css">

<!-- Ejemplo en Badge Circular -->
<div class="t-success-badge">
  <span class="t-success-check" id="paymentSuccessCheck" data-state="in" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <path pathLength="100" d="M13.5 24.5L21 32L35.5 16.5" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </span>
</div>

<script type="module">
  import { playSuccessCheck } from '/compon/new/success-check/success-check.js';
  
  // Re-disparar animación:
  playSuccessCheck('#paymentSuccessCheck');
</script>
```
