---
name: modo-produccion
description: revisa una app o landing, detecta problemas típicos y aplica correcciones con checklist fijo para publicarla.
---

# Modo Producción (QA + Fix)

## Cuándo usar este skill
- Cuando ya tienes algo generado (landing/app) y quieres dejarlo “presentable”.
- Cuando algo funciona “a medias” (móvil raro, imágenes rotas, botones sin acción, espaciados feos).
- Antes de enseñarlo a un cliente, grabarlo o publicarlo.

## Inputs necesarios
1. Qué archivo es el principal (por ejemplo `index.html` o ruta del proyecto).
2. Objetivo de la revisión: “lista para enseñar” o “lista para publicar”.
3. Restricciones: no cambiar branding / no cambiar copy / no tocar estructura, etc. (Si faltan, pregúntale al usuario).

## Workflow
1) **Diagnóstico rápido**: listar problemas identificados en 5–10 bullets (priorizados) en base al checklist de calidad.
2) **Plan de arreglos**: indicar “qué cambio y por qué” (máximo 8 cambios).
3) **Aplicar cambios**: modificar los archivos necesarios.
4) **Validación**: volver a abrir preview o simular renderizado y confirmar el checklist de forma exhaustiva.
5) **Resumen final**: listar cambios hechos y qué queda opcional para mejorar.

## Instrucciones

Aplica estrictamente este **Checklist de calidad (orden fijo)** durante las fases de diagnóstico y validación:

### A) Funciona y se ve
- Abre la preview / localhost sin errores.
- Imágenes cargan y no hay rutas rotas.
- Tipografías y estilos se aplican correctamente.

### B) Responsive (móvil primero)
- Se ve bien en móvil (no se corta, no hay scroll horizontal).
- Botones y textos tienen tamaños legibles.
- Secciones con espaciado coherente.

### C) Copy y UX básica
- Titular claro y coherente con la propuesta.
- CTAs consistentes (mismo verbo, misma intención).
- No hay texto “placeholder” tipo lorem ipsum.

### D) Accesibilidad mínima
- Contraste razonable en textos.
- Imágenes con atributos `alt`.
- Estructura de headings (h1, h2) lógica.

**Reglas adicionales de la ejecución:**
- No cambies el estilo de marca si existe un skill de marca activo o definido.
- No rehagas todo: corrige lo mínimo crítico para ganar calidad rápidamente.
- Si hay un conflicto entre que algo se vea “bonito” y “claro”, prioriza siempre la **claridad**.

## Output (formato exacto)
Devuelve siempre al finalizar este bloque:
1) **Diagnóstico**: (priorizado)
2) **Cambios aplicados**: (lista corta)
3) **Resultado**: “OK para enseñar” / “OK para publicar” + notas adicionales y siguientes pasos.

## Manejo de errores y correcciones
Si la calidad no aprueba el checklist incluso después de los arreglos previstos, detén el ciclo para no romper más código. Si un layout o comportamiento se daña masivamente al realizar la corrección rápida, retrocede el cambio (ctrl+z del agente), y pide intervención manual del humano con un diagnóstico del conflicto.
