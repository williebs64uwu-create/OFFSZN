ANTES. VE ESTE VIDEO LOOM ENTERO. Te explico paso a paso cómo usar este prompt de la manera correcta, lit dura menos de 10 minutos: https://www.loom.com/share/f6aa6fbfbb3346cf85679389876d5016 

Cómo hacer videos con Remotion, ahorrar x71 más tokens y escalar tu Marca Personal con Claude Code
La mayoría de creadores de contenido pierden horas editando videos manualmente. Los que usan Claude Code con Remotion + Graphify producen más contenido en menos tiempo — y gastan 71x menos tokens haciéndolo.

¿Qué es cada cosa?
Remotion — Tu editor de video como código
Remotion es un framework que te permite crear videos profesionales escribiendo código en React. En lugar de arrastrar clips en Premiere o CapCut, describes tu video en código y Claude Code lo edita por ti.
Perfecto para: intros de marca, carruseles animados, reels con subtítulos automáticos, vídeos de resultados, transiciones personalizadas — todo lo que necesitas para crecer en redes sociales con contenido visual consistente.
Graphify — La memoria permanente de Claude Code
Graphify es una habilidad de Claude Code que lee todos los archivos de tu proyecto una sola vez, construye un mapa de conocimiento (llamado grafo), y a partir de ese momento Claude consulta ese mapa en lugar de releer tus archivos desde cero cada sesión, no necesitas de API’s ni nada, todo es local en tu computadora.
Literal gastando menos de 71.5x menos tokens por consulta comparado con leer los archivos directamente.
Piénsalo así: sin Graphify, Claude es como un asistente con amnesia que cada día tienes que reexplicarle todo desde cero. Con Graphify, recuerda exactamente dónde está cada pieza de tu proyecto.

Por qué esta combinación multiplica tu Marca Personal
Un proyecto de Remotion crece rápido. Empieza con 5 archivos y en semanas tienes decenas de componentes, composiciones, helpers, assets, scripts de render. Sin Graphify, Claude tiene que leer todo eso cada vez que le pides un cambio — quema tokens, tarda más, y a veces alucina rutas o nombres de archivos.
Con Graphify activado:
Claude pregunta al grafo "¿dónde está el componente de subtítulos?" antes de abrir cualquier archivo
Tus ediciones son más rápidas y precisas
Gastas menos tokens = más sesiones dentro de tu plan
Claude entiende la arquitectura completa de tu proyecto desde el primer mensaje
Eso se traduce en: más vídeos producidos, más consistencia de marca, más tiempo libre para crear estrategia en lugar de estar pegado editando.

Requisitos previos
Antes de empezar necesitas tener instalado:
Claude Code — la CLI de Anthropic (si no lo tienes: npm install -g @anthropic-ai/claude-code)
Node.js versión 18 o superior — descárgalo en nodejs.org
Python 3.10 o superior — descárgalo en python.org (importante: durante la instalación marca "Add Python to PATH")

Paso 1 — Instalar Graphify
Abre Claude Code y corre este comando:
pip install graphifyy && graphify install
Nota: el paquete en PyPI se llama graphifyy (dos ”y”) porque el nombre graphify ya estaba ocupado. El comando que usas siempre es graphify con una sola “y”.
Después de instalarse, corre la integración específica para Claude Code:
bash
graphify claude install
Esto hace dos cosas: agrega una regla a tu CLAUDE.md y instala un hook que hace que Claude consulte el grafo automáticamente antes de buscar archivos.

Paso 2 — Crear tu proyecto Remotion
Si aún no tienes un proyecto, créalo con el template oficial:
bash
npx create-video@latest
Sigue el asistente: elige el nombre de tu proyecto, selecciona el template que prefieras (JavaScript o TypeScript), y deja que instale las dependencias.
Para abrir el Studio de Remotion y ver tu video en tiempo real:
bash
npm run dev
Se abrirá en tu navegador en http://localhost:3000 — desde ahí puedes previsualizar cualquier cambio antes de exportar.

Paso 3 — Indexar tu proyecto con Graphify
Con tu proyecto Remotion listo, entra a la carpeta del proyecto y construye el grafo de conocimiento:
/graphify
Graphify escaneará todos tus archivos y generará una carpeta graphify-out/ con:
graph.html — visualizador interactivo de tu grafo (puedes abrirlo en el navegador)
graph.json — datos del grafo, persistentes entre sesiones
GRAPH_REPORT.md — reporte legible con los nodos principales y conexiones sorprendentes
cache/ — chunks cacheados para que las actualizaciones futuras sean baratas
La primera vez tarda un poco dependiendo del tamaño del proyecto. Las siguientes veces es incremental — solo re-procesa lo que cambió.

Paso 4 — Agregar la regla de navegación a tu CLAUDE.md
Este es el paso que más gente se salta — y es el que realmente te ahorra los tokens.
Abre tu archivo ~/.claude/CLAUDE.md y agrega este bloque:
markdown
## Navegación de contexto
Cuando necesites entender el codebase, docs o archivos de este proyecto:
1. SIEMPRE consulta el grafo primero: `/graphify query "tu pregunta"`
2. Solo lee archivos raw si yo digo explícitamente "lee el archivo" o "mira el archivo raw"
3. Usa `graphify-out/wiki/index.md` como punto de entrada para navegar la estructura
Esta regla le dice a Claude que consulte el grafo antes de abrir cualquier archivo. Ahí está el ahorro de 71.5x.
O simplemente le puedes pedir a Claude Code que lo agregue por ti.

Flujo de trabajo diario
Pedirle cambios a Claude
Con Graphify activo, Claude ya sabe la estructura de tu proyecto. Solo dile qué quieres:
Agrega un título animado al inicio del video que aparezca con un fade-in de 30 frames
Cambia el color de fondo de todos los componentes de negro a #0A0A0A
Crea una nueva composición de 15 segundos para stories de Instagram con el logo centrado
Agrega subtítulos automáticos al video principal que aparezcan en la parte inferior
Claude consultará el grafo, encontrará los archivos exactos que necesita, y hará los cambios sin releer todo el proyecto desde cero.
Consultar el grafo directamente
También puedes pedirle a Claude que consulte el grafo antes de hacer algo:
/graphify query "¿qué componentes existen en el proyecto?"
/graphify query "¿dónde se define la composición principal?"
/graphify query "¿qué helpers de animación hay disponibles?"
Actualizar el grafo cuando el proyecto crece
Cuando agregas muchos componentes nuevos o haces cambios estructurales grandes, actualiza el grafo:
/graphify
El cache hace que sea rápido — solo re-procesa lo que cambió. Si quieres forzar una re-indexación completa, borra la carpeta cache/ primero.
Para actualizaciones parciales (por ejemplo, acabas de agregar un componente nuevo):
/graphify update src/components/NuevoComponente.tsx

Buenas prácticas
Re-indexa después de cambios estructurales grandes. Si agregaste 10 componentes nuevos, scripts de render, o reorganizaste carpetas — corre /graphify . para que el grafo refleje el estado actual.
Previsualiza siempre en el Studio antes de exportar. Corre npm run dev y revisa el video en localhost:3000 antes de lanzar un render largo. Ahorra mucho tiempo.
Decide si versionar graphify-out/. Puedes agregar la carpeta a .gitignore si el grafo es solo para tu uso local, o versionarla si trabajas en equipo y quieres que todos tengan el mismo contexto.
Mantén tu CLAUDE.md actualizado. Si cambias la estructura de tu proyecto de Remotion, agrega una nota en CLAUDE.md explicando los cambios principales. Claude lo leerá al inicio de cada sesión.

Solución de problemas frecuentes
"Claude no encuentra un archivo o componente" El grafo está desactualizado. Corre /graphify . para re-indexar.
"El grafo tiene información vieja" Borra la carpeta cache/ dentro de graphify-out/ y vuelve a correr /graphify . para una re-indexación completa.
"El render falla" Primero revisa en el Studio de Remotion (npm run dev). Si el video se ve bien en preview, el problema es de configuración del render. Si falla en preview, el error está en el código — pídele a Claude que lo diagnostique.
"pip no se reconoce como comando" Python no está correctamente en el PATH. Reinstala Python desde python.org marcando "Add Python to PATH" durante la instalación, luego reinicia la terminal.
"El grafo tardó mucho en construirse" Normal en la primera vez con proyectos grandes. Las siguientes corridas usan el cache y son mucho más rápidas.

El math que importa
Un proyecto de Remotion con 30-40 archivos puede costar 15,000-20,000 tokens solo para reestablecer contexto al inicio de cada sesión. Si haces 20 sesiones a la semana, son 300,000-400,000 tokens haciendo absolutamente nada productivo.
Con Graphify pagas ese costo una sola vez. El grafo persiste entre sesiones. Cada sesión futura empieza con Claude ya conociendo la estructura completa de tu proyecto de video.
Más sesiones disponibles dentro de tu plan = más videos producidos = más contenido para crecer en redes sociales = más marca personal.


El Siguiente Paso:

Si estás decidido a realmente cambiar tu situación y quieres hacer crecer tu Marca Personal, usando Claude Code y llevarla a +5k USD al mes junto a Dios, agenda una llamada conmigo para ayudarte personalmente a que lo consigas.
Agendar Llamada: Viraliza tu Contenido Junto a Dios
Esta es una llamada sin compromiso donde voy a analizar tu situación actual, ver los obstáculos clave y te mostraré cómo mi acompañamiento puede acelerar tus resultados. Tu tiempo es oro, no lo desperdicies intentando reinventar la rueda y hacerlo todo por tu cuenta.

Si tienes cualquier duda, escríbeme por Instagram y hablamos sin problema.
Usa estos consejos. Dios te bendiga.

Jose Manuel Corvera - elsenoresmipastor77

