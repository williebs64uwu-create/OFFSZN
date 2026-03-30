---
name: animacion-gsap
description: diseña e implementa animaciones fluidas y de alto rendimiento utilizando gsap, aplicando mejores prácticas para react y javascript vanilla.
---

# Animación con GSAP

## Cuándo usar este skill
- cuando el usuario pida animar elementos en la interfaz
- cuando se requieran secuencias complejas (timelines) o animaciones basadas en scroll (scrolltrigger)
- cuando se implementen micro-interacciones en react/next.js o vanilla js

## Inputs necesarios
- Elementos o componentes específicos a animar.
- Efecto deseado (fade, de izquierda a derecha, parallax, secuencia, etc.).
- Entorno de desarrollo (React, Next.js, Vanilla JS, etc.).

## Workflow
1) **Planificación**: Identificar el objetivo visual de la animación, los elementos seleccionados (nodos del DOM o componentes) y el entorno.
2) **Configuración**: Asegurar las importaciones correctas y registrar cualquier plugin adicional de GSAP (como `ScrollTrigger` o `useGSAP`).
3) **Desarrollo**:
   - En React: usar `useGSAP()` con el `scope` adecuado (ej. `containerRef`) para garantizar la limpieza (`cleanup`) en el desmontaje.
   - En Vanilla JS: usar `gsap.context()` si es necesario agrupar funciones de limpieza.
   - Usar `gsap.timeline()` para secuencias. Evitar encadenar `delay` manuales.
   - Usar transformaciones aceleradas por hardware (`x`, `y`, `scale`, `rotation`, `autoAlpha`).
4) **Optimización y Accesibilidad**: Usar `gsap.matchMedia()` para diferenciar por tamaño de pantalla o preferir reducción de movimiento (`prefers-reduced-motion`).
5) **Validación**: Comprobar interpolación a 60fps, que no haya fugas de memoria al cambiar de vista, y que actúe responsivamente.

## Instrucciones
- **Directrices para React/Next.js**: 
  - SIEMPRE usa el paquete `@gsap/react` y el hook `useGSAP`. Pasa SIEMPRE el objeto de configuración con la propiedad `{ scope: elRef }` para limitar los selectores a las referencias correspondientes.
  - Ejemplo base: `useGSAP(() => { gsap.to(".caja", { x: 100 }); }, { scope: mainRef });`
  - Para controladores de eventos generados tras el render (ej. "onClick"), encapsular la lógica usando `contextSafe`.
  - Nunca ejecutes código de GSAP o de ScrollTrigger durante Server-Side Rendering (SSR). Las animaciones solo deben correr en el cliente.
- **Rendimiento y CSS**: 
  - Evitar animar propiedades que re-renderizan el layout del documento (`width`, `height`, `top`, `left`, `margin`). 
  - Preferir SIEMPRE los alias de transformación como `x`, `y`, `scale`, `rotation`.
  - Preferir `autoAlpha` en vez de `opacity`, pues `autoAlpha` también ajusta a `visibility: hidden` cuando llega a 0 previniendo clics accidentales.
- **GSAP Variables**:
  - En las variables (`vars` / objeto de opciones), usar **camelCase** para propiedades CSS (ej. `backgroundColor`, `rotationX`).
  - Para secuencias que usen propiedades simultáneas desde un estado inicial, tener cuidado con múltiples elementos usando `from()`; si se superponen, usar `immediateRender: false` en los subsecuentes.

## Output (formato exacto)
Las implementaciones de este skill devolverán:
- Archivos de código (ej. `.js`, `.jsx`, `.tsx`, `.html`) actualizados con la animación GSAP debidamente importada e instanciada.
- Código auto-contenido y optimizado para pre-procesamiento del árbol de componentes en React (evitando memory leaks).

## Manejo de errores y correcciones
Si aparecen advertencias en React sobre estado luego de desmontar el componente, revisar que se esté usando `useGSAP` correctamente o invocando `ctx.revert()` en la función de limpieza. Si `ScrollTrigger` tiene imprecisiones o "saltos" en el cálculo, verificar que se llame a `ScrollTrigger.refresh()` luego de modificar el DOM o en la carga de fuentes/imágenes críticas.
