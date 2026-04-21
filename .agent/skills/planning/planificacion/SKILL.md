---
name: planificacion
description: escribe planes estructurados paso a paso divididos en tareas de cinco minutos basados en un diseño.
---

# Writing Plans

## Cuándo usar este skill
- cuando un diseño o especificación (del skill brainstorming) acaba de ser aprobado
- cuando se necesita descomponer trabajo grande de programación en pasos DRY y manejables
- cuando hay que orquestar las operaciones TDD para un agente de manera atómica

## Inputs necesarios
- Un documento de especificación técnica o arquitectura recientemente creada y refrendada.

## Workflow
1) **Plan**: Inspeccionar la especificación; corroborar el alcance y si se requieren archivos grandes de código planear el mapeo de archivos involucrados evitando chocar dependencias.
2) **Estructuración del Documento**: Escribir la cabecera del documento general de tareas.
3) **Deconstrucción Atómica**: Escribir el plan de ejecución en pasos estrictamente limitados de entre 2 a 5 minutos, detallando pruebas unitarias.
4) **Bucle de Revisión**: Efectuar revisiones de integridad del plan y enmendar donde haga falta antes de ejecutar comandos y presentarlo.
5) **Sugerencia de Ejecución**: Presentar el Markdown terminado al usuario y ofrecer las rutas de despacho: usando agentes de implementación en paralelo o implementando de inmediato e interactivamente.

## Instrucciones

El plan de trabajo debe ser escrito asumiendo que quien lo implementa es diestro pero **carece de cualquier contexto previo** o de buen juicio sobre tests. 
- Guarda el archivo en `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
- El archivo de plan SIEMPRE empezará con:
```markdown
# [Nombre del feature] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** [Descripción resumida de una oración]
**Architecture:** [Detalles breves]
**Tech Stack:** [Detalles técnicos]
---
```
- Escribe los pasos bajo el ciclo estricto RED-GREEN-REFACTOR de las operaciones de TDD. Cada Task (hito funcional o componente individual) debe contener:
```markdown
### Task N: [Nombre del Componente]

**Files:**
- Create/Modify/Test rutas exactas

- [ ] **Step 1: Write the failing test**
`código exacto de prueba`

- [ ] **Step 2: Run test to verify it fails**
`comando CLI` Expected: FAIL con ...

- [ ] **Step 3: Write minimal implementation**
`código productivo mínimo`

- [ ] **Step 4: Run test to verify it passes**
`comando CLI` Expected: PASS

- [ ] **Step 5: Commit**
git commit con buen mensaje
```
- Aporta contexto explícito, código exacto y comandos de consola replicables; evita indicaciones vagas del tipo ("agrega validación al final del callback"). Prohibido usar pseudocódigo en el plan de acción.

## Output (formato exacto)
Archivo markdown guardado en `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` conteniendo cabeceras, checklist atómico testeable, comandos completos sin ambigüedades listas para copiar o delegar.

## Manejo de errores y correcciones
Si durante la confección el agente o subagente de revisión denota que un archivo modificado crecería en más de centenares de líneas, se debe rectificar el plan fragmentándolo en archivos complementarios. Si el Output de un ciclo de validación de plan rebota por carencia de código puntual, vuelve e inyecta la implementación requerida sin excepciones antes de autorizar.
