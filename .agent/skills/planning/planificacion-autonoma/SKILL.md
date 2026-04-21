---
name: planificacion-autonoma
description: Gestiona tareas complejas para Antigravity mediante un bucle de ejecución autónoma. Divide el trabajo en un PRD, ejecuta iteraciones verificables y mantiene la memoria del progreso.
---

# Planificación Autónoma (Ralph Workflow)

## Cuándo usar este skill
- cuando el usuario pida una feature grande o compleja (ej: "Añadir un sistema de mensajes").
- cuando haya incertidumbre sobre cómo afectará un cambio al resto del sistema.
- cuando se necesite asegurar que cada paso se verifique (QA) antes de continuar.
- para evitar perder el hilo en conversaciones largas (Gestión de Contexto).

## Inputs necesarios
- **Requerimiento Principal**: El objetivo final del usuario.
- **Project Context**: Estado actual de los archivos afectados.

## Workflow (El Bucle de Antigravity)

1) **Fase de Inicio (PRD)**: 
   - Crear un archivo `tasks/prd.json` (o similar en la carpeta del proyecto).
   - Definir: `Contexto`, `Historias de Usuario` (pequeñas), `Acceptance Criteria` y `Priority`.
2) **Iteración Atómica**:
   - Elegir la historia de mayor prioridad que no haya pasado (`passes: false`).
   - Investigar, implementar y documentar en `progress.txt` lo aprendido.
3) **Fase de Verificación**:
   - Ejecutar pruebas automáticas (Playwright, tests locales) para validar el criterio de aceptación.
   - Si falla, corregir en la misma iteración. Si pasa, marcar en el PRD como `passes: true`.
4) **Commit & Memoria**:
   - Realizar commit de la iteración.
   - Actualizar `KNOWLEDGE.md` o el archivo de conocimiento del proyecto con nuevos patrones descubiertos.
5) **Siguiente Ciclo**: Repetir hasta que todas las historias en el PRD tengan `passes: true`.

## Instrucciones para el Agente (Tips de Ejecución)
- **Dividir es Vencer**: Cada "historia" en el PRD debe ser lo suficientemente pequeña para completarse en un par de turnos. No pongas "Hacer el backend", pon "Crear tabla de mensajes en Supabase".
- **Sin Saltos**: No saltes a la siguiente tarea hasta que la actual esté verificada y guardada.
- **Aprendizaje Continuo**: Ralph brilla porque guarda lo que aprende. Si descubres que "el navbar de OFFSZN requiere v=20 en el JS", anótalo de inmediato en el archivo de progreso.

## Output (formato exacto)
Al iniciar, muestra al usuario:
- El `PRD.json` generado (en formato tabla o lista clara).
- El plan de la primera iteración.

## Manejo de errores y correcciones
- Si el contexto se llena demasiado, usa el PRD para saber exactamente dónde te quedaste tras un reset de conversación.
- Si una tarea se vuelve demasiado grande, divídela en dos nuevas historias dentro del PRD durante el bucle.
