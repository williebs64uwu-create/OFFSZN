---
name: crear-skills
description: diseña skills predecibles, reutilizables y fáciles de mantener para el entorno antigravity.
---

# Creador de Skills para Antigravity

## Cuándo usar este skill
- cuando el usuario pida crear un skill nuevo
- cuando el usuario repita un proceso y pida un skill
- cuando se necesite un estándar de formato en Antigravity
- cuando haya que convertir un prompt largo en un procedimiento reutilizable

## Inputs necesarios
- Objetivo del skill a crear.
- Disparadores (cuándo se usará).
- (Opcional) Ejemplos, pasos o lógica específica que debe tener.

## Workflow
1) **Plan**: Entender el objetivo final y asegurar tener los inputs necesarios.
2) **Estructuración**: Definir la estructura de carpetas `agent/skills/<nombre-del-skill>/` (archivo mínimo: `SKILL.md`). 
3) **Desarrollo (YAML y Reglas)**: Escribir el frontmatter (name corto, description concisa sin marketing) y definir los principios de escritura.
4) **Validación**: Revisar coherencia, posibles errores y aplicar restricciones exactas al formato estandarizado.
5) **Ejecución**: Generar la salida estandarizada mostrando al usuario la estructura o creando directamente los archivos.

## Instrucciones

- **Estructura mínima**: `agent/skills/<nombre-del-skill>/SKILL.md`. Agrega `recursos/`, `scripts/` o `ejemplos/` solo si aportan valor real a la tarea, no los crees por defecto.
- **YAML Frontmatter**: 
  - `name`: corto, minúsculas, guiones, máx 40 caracteres (ej. planificar-video). Sin nombres de herramientas (ej. ChatGPT/Claude).
  - `description`: en español, tercera persona, máx 220 caracteres. Debe decir qué hace y cuándo usar. Cero marketing.
- **Principios de escritura**:
  - Sé claro sobre longitud: mejor pocas reglas, pero claras. Sin relleno ni texto de blog (es un manual de ejecución).
  - Separa responsabilidades: estilos en recursos, pasos en el flujo de trabajo (workflow).
  - Si un input es crítico para la tarea y falta, el skill debe indicar que pregunte al usuario.
  - Define exactamente qué formato se devuelve (lista, tabla, JSON, markdown).
- **Niveles de libertad (Rigidez vs Flexibilidad)**:
  - *Alta libertad (heurísticas)*: Útil para brainstorming o ideas.
  - *Media libertad (plantillas)*: Útil para generar documentos, copys, estructuras.
  - *Baja libertad (pasos exactos / comandos)*: Útil para operaciones frágiles, scripts o cambios técnicos. Entre más riesgo, más bajo debe ser el grado.

## Output (formato exacto)
Al crear un skill, de no guardarlo directamente en el sistema, muestra esta estructura de manera exacta en tu respuesta:

Carpeta
`agent/skills/<nombre-del-skill>/`

SKILL.md
```markdown
---
name: <nombre-en-minúsculas-con-guiones>
description: <descripción en 3ª persona, máx 220 caracteres>
---
# <Título del skill>
## Cuándo usar este skill
- <trigger 1>
- <trigger 2>

## Inputs necesarios
- <input 1>
- <input 2>

## Workflow
1) <paso 1>
2) <paso 2>

## Instrucciones
<manual de ejecución>

## Output (formato exacto)
<formato de la salida a entregar al usar el skill>

## Manejo de errores y correcciones
<qué hacer si falla o cómo iterar>
```

Recursos opcionales (solo si aportan valor)
- `recursos/<archivo>.md`
- `scripts/<archivo>.sh`

## Manejo de errores y correcciones
Si el resultado o skill creado no cumple el formato o las restricciones de Antigravity, vuelve al paso de estructuración y re-escribe el skill limitando la ambigüedad. Si los parámetros iniciales para estructurarlo no tienen sentido, solicita aclaraciones en un mensaje aparte antes de asumir.
