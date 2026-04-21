---
name: brainstorming
description: convierte ideas en diseños aprobados paso a paso mediante diálogo colaborativo antes de escribir código.
---

# Brainstorming Ideas Into Designs

## Cuándo usar este skill
- cuando el usuario pide escribir código para un nuevo proyecto sin diseño previo
- cuando el usuario presenta una nueva feature o funcionalidad, grande o pequeña
- cuando sea necesario diseñar o estructurar componentes antes de la implementación
- cuando es evidente la necesidad de pensar antes del código ("Anti-Patrón: Esto es muy simple para necesitar diseño")

## Inputs necesarios
- El requerimiento inicial, idea, o solicitud técnica.
- Archivos y el contexto actual del proyecto (repositorios, documentos, commits recientes).

## Workflow
1) **Plan (Entender Contexto)**: Leer estado actual. Evaluar si la idea abarca múltiples subsistemas o es de un solo dominio. Si es múltiple, pedir descomponer.
2) **Validación Visual**: Si el trabajo amerita entendimiento visual (interfaces), enviar solo el compañero visual/preguntas UI de manera independiente antes de proseguir.
3) **Clarificación**: Hacer **una y solo una** pregunta aclaratoria a la vez sobre propósito, restricciones o criterio de éxito (preferente selección múltiple). Reiterar hasta dominar el objetivo.
4) **Propuestas Técnicas**: Proponer 2 a 3 enfoques para estructurar/arquitectar, recomendando el óptimo con pros y contras.
5) **Aprobación de Diseño**: Presentar la solución a nivel técnico, abordando las secciones (flujo de datos, interfaz, pruebas). Preguntar si le parece correcto al usuario. Escribir y validar specs en archivos.
6) **Ejecución (Hand-off)**: Ceder control a la habilidad de `planificacion`.

## Instrucciones
- **Comportamiento Estricto**: Tienes NEGADO invocar habilidades de implementación (escribir código, frontend-design, comandos de instalación masivos) hasta tener el diseño presentado y explícitamente aprobado.
- Formula preguntas una a una, evita listas pesadas. 
- Principio **YAGNI**: Filtra de forma implacable las ideas para evitar crear o sugerir implementaciones excesivamente futuras.
- **Micro-arquitectura**: Favorece unidades pequeñas orientadas a interfaces claras y single-responsibility.
- Al interactuar donde ya exista código, propón un diseño que siga los patrones previos.
- Escribe el diseño a un documento de especificación formal `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`, realiza commit luego de aprobación y pasa directamente la ejecución al skill `planificacion`.

## Output (formato exacto)
Documento en formato Markdown guardado en la carpeta designada: `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md` confirmando la arquitectura pactada mutuamente, seguido con mensaje en chat invocando el cambio a la habilidad de planificacion.

## Manejo de errores y correcciones
Si entra un loop interminable de rediseño (más de 3 iteraciones entre spec erróneos y revisiones en subagentes paralelos), detén la ejecución en seco y solicita la opinión directa del humano reportando amablemente la falla en resolver el plan. Si el usuario se salta o ignora el diseño exigiendo código, muéstrale este comportamiento como perjudicial e insístele cortésmente en asegurar el entendimiento.
