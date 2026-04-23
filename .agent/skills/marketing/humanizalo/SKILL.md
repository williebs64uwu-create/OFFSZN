---
name: humanizalo
description: detecta patrones de escritura de IA y reescribe el contenido para que suene natural, directo y con personalidad humana.
---

# Humanízalo

## Cuándo usar este skill
- cuando un texto generado suene demasiado "robótico" o artificial.
- antes de publicar contenido en redes sociales, blogs o correos.
- para eliminar el "AI slop" (frases vacías y estructuras repetitivas).
- cuando el usuario pida que un texto sea más "cercano" o "natural".

## Inputs necesarios
- **Texto original**: el contenido que suena a IA.
- **Tono deseado (Opcional)**: profesional, casual, provocativo, etc. (por defecto será natural y directo).

## Workflow
1) **Detección**: Escanea el texto buscando los +40 patrones de IA (ver `recursos/patrones-ia.md`).
2) **Desmantelamiento**: Elimina conectores innecesarios ("además", "crucial"), frases infladas y estructuras binarias.
3) **Reescritura**: Redacta el contenido desde cero priorizando la claridad y el impacto.
4) **Inyección de Personalidad**: Añade ritmo variado, opiniones o detalles específicos que den "alma" al texto.
5) **Validación**: Autoevalúa el resultado usando el sistema de puntuación de 6 dimensiones (Directo, Ritmo, Confianza, Autenticidad, Densidad, Alma).

## Instrucciones

- **Elimina el "Grasseo"**: Quita palabras como "navegar", "panorama", "holístico", "profundizar", "testamento".
- **Rompe la Monotonía**: Varía el largo de las oraciones. Una corta. Una larga que explique algo. Otra corta para impactar.
- **Sé Directo**: No digas "Es importante notar que...", di "Nota esto:".
- **Evita Conclusiones de IA**: Si el texto termina con "En resumen, el futuro de X es prometedor...", bórralo o cámbialo por un CTA real o una opinión fuerte.
- **Cuidado con los Guiones**: No uses guiones largos (—) para añadir incisos de forma mecánica; usa comas o puntos.
- **Formato Humano**: Usa negritas solo en ideas clave, no de forma algorítmica. No abuses de los emojis decorativos.

## Output (formato exacto)

El output debe presentar la comparativa y el texto final:

---
### 🔍 Análisis de Patrones Detectados
- **[Categoría]**: [Ejemplos encontrados]
- ...

### ✨ Texto Humanizado
[Contenido reescrito con ritmo y personalidad]

### 📊 Evaluación de Calidad (Score: X/60)
- **Directo**: X/10 | **Ritmo**: X/10 | **Confianza**: X/10
- **Autenticidad**: X/10 | **Densidad**: X/10 | **Alma**: X/10
---

## Manejo de errores y correcciones
- Si el texto sigue sonando a IA, realiza una segunda pasada enfocándote exclusivamente en el **Ritmo** y el **Alma**.
- Si el usuario siente que el texto perdió información crítica, ajusta la **Densidad** para reincorporar los datos sin el lenguaje robótico.
