---
name: cro-audit
description: analiza páginas de marketing para detectar fricciones, falta de claridad y puntos de fuga de usuarios, proponiendo mejoras accionables.
---
# Auditoría CRO (Conversion Rate Optimization)
## Cuándo usar este skill
- Cuando el usuario comparta un URL o archivo HTML y pregunte "¿por qué no convierte?".
- Antes de lanzar una nueva página o feature importante (perfil público, catálogo).
- Cuando el bounce rate sea alto o los usuarios se queden estancados en un flujo.

## Inputs necesarios
- **Archivo/URL**: Página a analizar.
- **Contexto**: `.agent/recursos/marketing-context.md`.
- **Métrica Clave**: Qué acción queremos que haga el usuario (compra, registro, etc.).

## Workflow
1) **Prueba de los 5 Segundos**: ¿Es obvio qué es el producto y para quién es?
2) **Análisis de Jerarquía**: ¿Lo más importante es lo más visible? (Titular > CTA > Prueba Social).
3) **Detección de Fricción**: ¿Hay demasiados campos? ¿Demasiada navegación que distrae? ¿Diseño confuso?
4) **Evaluación de Confianza**: ¿Hay logos, testimonios o garantías cerca de los botones de acción?
5) **Generación de "Quick Wins"**: Cambios de 5 minutos con alto impacto potencial.

## Instrucciones
- Sé despiadado con la claridad. Si un texto es "creativo" pero no se entiende, critícalo.
- Busca "fugas" de atención: links innecesarios en el header durante un proceso de registro.
- Revisa el Mobile Experience: la mayoría de los artistas/productores navegan en móvil.
- **Checklist de Auditoría**:
  - [ ] Value Prop clara.
  - [ ] CTA visible sin scroll (Above the fold).
  - [ ] Prueba social presente.
  - [ ] Manejo de objeciones (FAQ o notas).

## Output (formato exacto)
### 🔍 Auditoría de Conversión: [Nombre de la Página]
**Status Actual**: 🔴 Crítico / 🟡 Mejorable / 🟢 Optimizado

#### 1. Quick Wins (Impacto Inmediato)
- [Cambio 1] -> [Motivo]
- [Cambio 2] -> [Motivo]

#### 2. Problemas de Alta Fricción
- [Descripción del problema]
- **Solución Propuesta**: [X]

#### 3. Test de A/B Recomendado
- **Hipótesis**: "Si cambiamos [X] por [Y], las conversiones subirán porque [Z]".

## Manejo de errores y correcciones
Si no hay suficiente contexto sobre la audiencia (ej. no se sabe si el tráfico viene de redes o SEO), indícale al usuario que la recomendación puede variar según la "temperatura" del tráfico (usuarios fríos vs calientes).
