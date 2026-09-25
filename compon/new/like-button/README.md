# Like Button • OFFSZN UI Component

Microinteracción de Like con corazón spring-pop (rebote elástico) y explosión radial de 8 partículas calculadas orgánicamente por JS.

## Rutas
- CSS: `compon/new/like-button/like-button.css`
- JS: `compon/new/like-button/like-button.js`

## Comando rápido para Antigravity:
```
Usa el componente Like Button (compon/new/like-button/) en [tarjeta de beat / kit / preset].
```

## Uso rápido
```html
<link rel="stylesheet" href="/compon/new/like-button/like-button.css">

<button type="button" class="t-like" data-liked="false" aria-pressed="false">
  <span class="t-like-icon-wrap">
    <span class="t-like-icon">
      <svg class="t-like-heart" width="16" height="16" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke-width="2"/>
      </svg>
    </span>
    <span class="t-like-particles">
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </span>
  </span>
  <span>Like</span>
</button>

<script type="module" src="/compon/new/like-button/like-button.js"></script>
```
