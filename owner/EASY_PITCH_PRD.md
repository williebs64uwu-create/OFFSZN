# EASY PITCH PRD de producto

Afinador vocal independiente de OFFSZN

Versión 1.1 · 19 de septiembre de 2026

## 1 Decisión de producto

EASY PITCH será un plugin dedicado a la afinación automática de una voz individual. El usuario selecciona la tonalidad y la escala y ajusta dos controles: Rapidez y Cantidad. El producto debe permitir corrección discreta y afinación marcada, con una interfaz compacta y funcionamiento local.

La prioridad es que el sonido sea estable, que las palabras conserven claridad y que el usuario pueda trabajar sin estudiar DSP. La sencillez debe estar en la interacción; el motor necesita detección fiable, decisiones musicales consistentes, transformación de audio de calidad y una latencia comprobada.

La naturalidad se implementa dentro del motor. Transiciones, vibrato, notas largas y estabilidad se coordinan con Rapidez y con la voz analizada. La interfaz principal conserva Key, Escala, Rapidez y Cantidad. Esta revisión define el trabajo para construir y validar esos comportamientos; no afirma que el DSP ya esté implementado.

Este PRD fija el comportamiento del producto y sus condiciones de aceptación. La IA de desarrollo elegirá algoritmos, bibliotecas, arquitectura de integración y herramientas de compilación mediante pruebas comparables. Las cifras identificadas como objetivos son requisitos propuestos para evaluar el desarrollo, no resultados obtenidos.

### Identidad y uso

Nombre visible: EASY PITCH. Marca: OFFSZN. Descripción: Afinador vocal. Uso principal: inserto en una pista vocal dentro del DAW. Público: artistas que graban sus voces y productores que necesitan afinarlas con rapidez. Sonidos de referencia de uso: interpretación natural y efecto de afinación marcada habitual en música urbana y pop.

EASY PITCH es independiente de Vocal Preset. Su instalador, identidad de plugin, parámetros, presets y estado de sesión deben ser propios. Compartir infraestructura mantenida de OFFSZN es válido; compartir una instancia musical o depender de otro plugin no lo es.

### Distinción esencial

La tonalidad de la canción se elige manualmente. Internamente, el motor sí debe detectar la frecuencia fundamental de la voz para saber cuánto corregirla. No necesita reconocimiento de palabras, comandos hablados, IA conversacional ni detección automática de la tonalidad.

## 2 Alcance del lanzamiento

Todas las funciones del lanzamiento son necesarias para una primera versión utilizable. Las funciones futuras no deben aparecer como botones inactivos ni bloquear la puesta a punto del afinador.

| Área | Incluido en el lanzamiento | Condición principal |
|---|---|---|
| Afinación | Corrección monofónica continua | Conserva duración y ritmo de la toma |
| Tonalidad | Doce tonalidades y selección manual | Valor siempre visible |
| Escala | Mayor y Menor natural | Selección explícita y persistente |
| Controles | Rapidez y Cantidad | Mayor valor significa mayor rapidez o corrección |
| Naturalidad | Transiciones, vibrato y notas largas integrados | Comportamiento interno coordinado con Rapidez |
| Timbre | Conservación del timbre por defecto | Validada con voces, sin prometer identidad perfecta |
| Ajuste vocal | Rango de voz en Personalizar | Ayuda al seguimiento sin cambiar la escala |
| Información | Nota de entrada, objetivo y corrección aplicada | Solo datos reales del motor |
| Trabajo diario | Activación, comparar original, presets y guardar | Integración correcta con el host |
| Distribución | Windows x64 VST3 como plataforma inicial | FL Studio y Ableton comprobados |
| Interfaz | HTML y CSS con WebView y puente nativo | Funciona sin internet y con el editor cerrado |

No pertenecen a EASY PITCH: rack de efectos, reverb, chorus, ecualizador, compresor, comandos de voz, generación de audio, armonizador, transformación de identidad vocal, grabador, separador de voces ni modo envío. Tampoco se integra un editor gráfico de notas en el lanzamiento.

La entrada soportada es una voz individual. Varias voces diferentes en la misma pista, acordes, una mezcla completa o audio con efectos intensos quedan fuera del uso garantizado. El plugin debe mantenerse estable ante esas señales y reducir la intervención cuando no pueda seguir una altura fiable.

## 3 Experiencia de uso

### Primera apertura

La pantalla aparece lista para configurar. Key muestra Elegir y Escala muestra Mayor. Rapidez comienza en 65 por ciento y Cantidad en 100 por ciento como valores iniciales propuestos. Hasta elegir una tonalidad, la voz pasa sin corrección y con la compensación temporal necesaria. Un único texto fijo dice Elige la tonalidad. No se abre un tutorial obligatorio.

Al elegir la tonalidad, la corrección comienza mediante una transición suave. La pantalla no cambia de vista. El usuario escucha y ajusta Rapidez y Cantidad. En sesiones guardadas se restaura la tonalidad y el sonido anteriores; nunca se vuelve a Elegir durante una reapertura de proyecto.

### Afinación natural

El usuario elige Key y Escala y empieza con el carácter Suave. Al bajar Rapidez, el motor suaviza las transiciones y favorece la conservación del movimiento expresivo fiable. Cantidad permite reducir la intervención global cuando se desea. La conservación interna del vibrato debe poder funcionar también con Cantidad al 100 por ciento; se corrige el centro de la nota sin exigir que toda oscilación desaparezca. El producto no promete distinguir siempre un error de una intención expresiva.

### Afinación marcada

El usuario mantiene Cantidad al máximo y aumenta Rapidez. Debe oír una corrección más inmediata y transiciones definidas. Ese carácter proviene de la trayectoria de afinación; no se añade distorsión, saturación ni un cambio de formantes como efecto secundario deliberado.

### Corrección de problemas

Si afina hacia notas incorrectas, el usuario revisa Key y Escala. Si salta octavas o pierde una voz grave/aguda, abre Personalizar y ajusta Rango de voz. Si la monitorización resulta tardía, revisa el buffer del DAW y la latencia informada por EASY PITCH. La ayuda separa estos casos y evita mensajes genéricos de aumentar calidad.

La afinación se coloca preferentemente antes de reverb, delay, dobles y distorsión intensa. Una grabación limpia facilita el seguimiento; las recomendaciones de uso de Antares también sitúan la corrección antes del procesamiento creativo intenso. [S1]

## 4 Interfaz y nombres simples

### Pantalla principal

Una sola pantalla, aproximadamente 780 por 460 píxeles lógicos, con escala de interfaz 100, 125 y 150 por ciento. El tamaño es una propuesta de partida: se ajustará al probar legibilidad y espacio real en los hosts.

Cabecera: OFFSZN, EASY PITCH, selector de preset, Guardar y Activar. Primera fila: Key y Escala, con el mismo peso visual. Centro: dos perillas grandes, Rapidez y Cantidad. Franja inferior: Entrada, Objetivo y Ajuste, seguida de Escuchar original y Personalizar. Ayuda y opciones de interfaz se abren desde un icono discreto.

No incluir desplegables de modo Hablar/Efectos, selector Inserto/Envío, tarjetas de otros procesadores ni un gran analizador espectral. El espacio central se dedica a controlar la afinación.

### Lenguaje visible

| Etiqueta | Texto breve de ayuda | Evitar como nombre principal |
|---|---|---|
| Key | Tonalidad de la canción | Pitch class, tonic index |
| Escala | Notas hacia las que se corrige | Quantization mask |
| Rapidez | Qué tan rápido llega a la nota | Retune coefficient |
| Cantidad | Cuánto corrige la afinación | Wet, mezcla dry/wet |
| Conservar timbre | Ayuda a mantener el carácter de tu voz | Spectral envelope correction |
| Rango de voz | Limita la zona donde busca tu voz | F0 candidate bounds |
| Entrada | Nota detectada en la voz | Nota corregida |
| Objetivo | Nota hacia la que está afinando | Salida medida si no se mide |
| Ajuste | Desplazamiento que aplica, en cents | Confianza de la IA |

En Key mostrar nombres equivalentes cuando ayuden: C / Do, C♯ / Re♭, D / Re, D♯ / Mi♭, E / Mi, F / Fa, F♯ / Sol♭, G / Sol, G♯ / La♭, A / La, A♯ / Si♭, B / Si. Hay doce clases, no valores distintos para sostenido y bemol equivalentes. En el selector de escala escribir Menor natural, evitando que Menor se interprete como armónica.

### Personalizar

Se abre únicamente mediante su botón. Muestra Rango de voz, Conservar timbre, Referencia y Restablecer ajustes. Volver o Escape cierra el panel sin revertir cambios. Abrirlo no modifica parámetros, no interrumpe el audio y no crea un segundo editor.

Transición, vibrato, tolerancia y notas largas son comportamientos internos. No se añaden perillas, interruptores, modos ni parámetros automatizables para ellos en la versión inicial. Las herramientas de ajuste del desarrollador permanecen fuera de la interfaz distribuida. Personalizar conserva los ajustes finos ya definidos.

Rango de voz ofrece General, Grave y Aguda. Referencia permite ajustar la afinación de A4; la ayuda la identifica como la referencia estándar de 440 Hz. No hay deslizadores de duración ni controles de efectos de Vocal Preset.

### Interacción y apariencia

Tema inicial: grafito mate, texto blanco suave y un acento verde grisáceo discreto. Propuesta de tokens: fondo #111416, panel #1B2024, texto #F2F4F5, secundario #B4BDC5 y acento #A9C2B0. Bordes sutiles, sin textura densa ni luces continuas. El estado activo debe distinguirse también por texto o forma, no solo por color.

Permitir arrastre vertical de perillas, doble clic para introducir un número, modificación fina con Shift y restablecimiento explícito en menú contextual. Tab recorre controles en orden; Escape cierra paneles. No capturar atajos globales del DAW ni permitir que la rueda altere un valor por pasar el cursor accidentalmente.

Objetivos de accesibilidad: texto principal de 14 a 16 píxeles lógicos, zonas pulsables de al menos 32 por 32 y contraste comprobado de 4.5 a 1 para texto normal. Son requisitos de diseño propuestos, no una declaración de certificación. Tooltips cortos; explicaciones largas solo en Ayuda.

### Datos y estados

| Situación | Comportamiento de audio | Lo que muestra |
|---|---|---|
| Falta elegir Key | Sin corrección | Elige la tonalidad |
| Voz afinable | Corrección según controles | Entrada, Objetivo y Ajuste reales |
| Silencio | Cero entrada produce cero salida tras vaciar buffers | Campos de nota vacíos y sin animaciones |
| Respiración o consonante | Conservación temporal y del audio, sin forzar nota | Sin objetivo musical inventado |
| Seguimiento incierto | Reducir intervención de forma suave | Indicador discreto solo si persiste |
| Desactivado | Original con retardo compensado | Afinación desactivada |
| WebView no disponible | Continúa el estado musical del procesador | Aviso mínimo de recuperación |

Los indicadores no deben congelar una nota vieja en silencio. Puede haber una retención visual de hasta 150 ms para evitar parpadeo; ese retardo de visualización no autoriza a reutilizar una estimación antigua para corregir audio nuevo.

## 5 Contrato de controles y presets

Los siguientes nombres de parámetros son una propuesta de identificación estable. La IA puede adaptarlos antes de la primera versión pública, conservando significado, unidades y migraciones documentadas después del lanzamiento.

| ID propuesto | Control | Rango o valores | Inicial |
|---|---|---|---|
| enabled | Activar | Apagado o encendido | Encendido |
| key | Key | Sin elegir o doce clases | Sin elegir |
| scale | Escala | Mayor o Menor natural | Mayor |
| speed | Rapidez | 0 a 100 por ciento | 65 |
| amount | Cantidad | 0 a 100 por ciento | 100 |
| voiceRange | Rango de voz | General, Grave, Aguda | General |
| preserveTimbre | Conservar timbre | Apagado o encendido | Encendido |
| referenceHz | Referencia | 430 a 450 Hz | 440 Hz |

Rapidez es monótona en pruebas equivalentes: subirla acelera la respuesta musical nominal y hace más definida la corrección. Cero significa la respuesta más lenta disponible, no desactivación. Cien significa la más rápida comprobada, no cero latencia física. La IA propondrá una curva perceptual y medirá sus tiempos de establecimiento con escalones de afinación. La UI no mostrará milisegundos si solo son una constante interna que no corresponde al comportamiento completo.

Cantidad interpola la altura entre la voz original y la trayectoria corregida. Una voz 40 cents por debajo de un objetivo estable, con Cantidad 50 por ciento y después de estabilizarse, debe quedar aproximadamente 20 cents por debajo. No se implementa sumando audio original y afinado.

Con Cantidad cero o Activar apagado, la ruta debe ser el original compensado temporalmente. Mantener el procesamiento interno necesario para volver a activar sin llenar buffers desde cero ni producir saltos. El bypass del host se comprueba aparte; su compensación no se debe asumir idéntica en todos los DAW.

Rangos iniciales para investigación: General 65 a 1000 Hz, Grave 65 a 450 Hz y Aguda 130 a 1000 Hz. No son categorías por sexo ni límites comerciales garantizados. Si una voz cae fuera del rango, no transportarla automáticamente una octava para hacerla caber; reducir corrección y permitir cambiar de rango. Fijar límites finales con datos.

### Coordinación interna de Rapidez

Rapidez gobierna un conjunto documentado de curvas continuas: respuesta hacia el centro tonal, transición entre objetivos y conservación de movimiento expresivo. La adaptación a notas sostenidas depende también de la evolución temporal de la voz. Cantidad se aplica al desplazamiento resultante y no cambia el detector ni selecciona otro motor.

| Referencia de ajuste | Respuesta interna deseada | Condición de calidad |
|---|---|---|
| Suave con Rapidez 35 | Transiciones flexibles y más vibrato conservado | El centro tonal debe corregirse de forma suficiente |
| Firme con Rapidez 65 | Respuesta más rápida y expresión moderada | Las frases rápidas conservan su articulación |
| Marcado con Rapidez 100 | Corrección más inmediata y menos variación residual | Se mantienen claridad, timbre y estabilidad |

Estos tres puntos sirven para calibrar una curva; no son tres modos ocultos. Los valores intermedios interpolan sin saltos. Subir Rapidez no debe relajar los criterios de señal fiable ni forzar consonantes hacia una nota. La conservación del timbre permanece activa por defecto en todo el recorrido.

Con el mismo audio, parámetros, revisión del motor e historial desde un reinicio equivalente, el resultado debe ser reproducible dentro de la tolerancia numérica definida. Cargar Suave y después fijar manualmente los valores de Firme debe producir el mismo comportamiento que cargar Firme. No asociar secretos musicales al nombre del preset.

### Presets simples

Incluir Suave, Firme y Marcado como caracteres de fábrica. Valores iniciales propuestos: Suave 35 de Rapidez y 80 de Cantidad; Firme 65 y 100; Marcado 100 y 100. Estos valores se calibran con el motor final. Cambiar carácter modifica solo Rapidez y Cantidad, conservando Key, Escala, Rango de voz, Referencia y Conservar timbre.

Guardar crea un preset del usuario con todos los parámetros musicales. Cargar un preset del usuario sí restaura su tonalidad y escala; la UI las actualiza al mismo tiempo. Los archivos deben tener versión de esquema y un nombre válido. Guardar sobre un preset existente requiere una acción explícita; los de fábrica no se sobrescriben.

Escuchar original es una comparación momentánea mientras se mantiene pulsado el botón. Al soltar o perder foco vuelve al estado previo. No cambia enabled, no se guarda con la sesión y no deja el afinador desactivado por cerrar la ventana. Se comparan señales con la misma latencia y sin compensación de volumen automática no solicitada.

## 6 Especificación musical y DSP

### Escalas y selección de nota

Mayor usa intervalos 0, 2, 4, 5, 7, 9 y 11 desde la tónica. Menor natural usa 0, 2, 3, 5, 7, 8 y 10. La máscara se repite por octavas y se transpone por Key. Las doce tonalidades de ambas escalas se verifican exhaustivamente.

El objetivo se obtiene entre notas permitidas próximas a la altura de entrada, considerando la continuidad temporal. En una frontera entre notas se usa histéresis: conservar la anterior hasta disponer de evidencia suficiente de cambio. Al iniciar una voz sin historia, un empate exacto usa una regla determinista documentada, por ejemplo la nota inferior. Cambiar Key o Escala invalida objetivos anteriores que ya no estén permitidos.

La histéresis no debe bloquear melodías rápidas ni saltos de octava reales. La afinación tampoco puede deducir siempre la intención del cantante solo a partir de una escala: una nota muy desviada puede acercarse a otra nota válida. Esa limitación debe explicarse en Ayuda sin convertirla en un mensaje constante.

### Detección de altura

La entrada del detector es una copia de análisis de la voz, anterior a la transformación. Devolver frecuencia estimada, candidatos si existen, confianza o periodicidad con significado documentado, estado sonoro/no sonoro y posición temporal en muestras. Limpiar DC o filtrar para análisis no autoriza a ecualizar la salida audible.

Comparar un detector causal de la familia YIN con una variante de seguimiento de candidatos. pYIN sustenta el valor de conservar alternativas antes de elegir la trayectoria; su trabajo combina candidatos probabilísticos y seguimiento HMM. La publicación no demuestra por sí sola una implementación de monitorización con baja demora. [S2]

Probar especialmente fundamental débil, armónicos dominantes, voz aireada, ataques suaves, consonantes, glissandos y saltos de registro. La confianza no debe ser un porcentaje decorativo. Ajustar los umbrales con datos separados de los utilizados para seleccionar parámetros.

### Trayectoria de corrección

Trabajar la distancia musical en semitonos o cents. Obtener el objetivo permitido, construir una trayectoria con la respuesta de Rapidez y aplicar Cantidad sobre la distancia de corrección. Convertir ese desplazamiento a una relación de frecuencias para el transformador de audio.

Al cambiar una nota objetivo, suavizar lo necesario para evitar clics sin borrar el efecto rápido. Suavizar una orden de UI y suavizar la intención musical son tareas distintas. Ningún filtro de control puede introducir una demora oculta que luego se atribuya al detector.

Al perder una altura fiable, mantener solo la continuidad mínima validada y llevar el desplazamiento a cero o a una ruta original alineada. No seguir afinando una nueva consonante con la última nota de una vocal. Al recuperar voz, evitar arrastrarla desde el objetivo de la frase anterior.

### Naturalidad integrada en el motor

Separar el centro tonal estimado del movimiento alrededor de ese centro. Con evidencia suficiente de vibrato, corregir el centro y conservar una proporción de la oscilación según Rapidez. El movimiento no periódico, el ruido o un fallo del detector no se consideran vibrato automáticamente. No sintetizar una oscilación cuando la interpretación no la contiene. Si la clasificación es incierta, usar el seguimiento básico validado y una transición suave entre comportamientos.

La transición entre dos objetivos y la corrección dentro de una nota deben tener estados diferenciados aunque compartan una sola perilla. Un deslizamiento breve no debe convertirse sistemáticamente en una escalera de notas en el extremo suave. Una nota nueva sostenida sí debe poder reemplazar el objetivo anterior. Medir ese equilibrio con frases rápidas, portamentos y vibrato ancho; aumentar estabilidad sin estas pruebas puede bloquear la melodía.

Durante la parte sostenida de una nota fiable, permitir más movimiento expresivo en ajustes suaves. La entrada de una nueva nota vuelve a la respuesta adecuada para su ataque; no hereda indefinidamente la lentitud de la nota larga anterior. La desviación sostenida del centro continúa corrigiéndose. Cerca del extremo marcado, reducir de forma gradual esta relajación y la conservación del vibrato para permitir afinación deliberadamente rígida.

Estas operaciones trabajan en la trayectoria musical y deben respetar la alineación temporal de la sección 6. No añadir cadenas de suavizado independientes sin medir su demora acumulada. Toda ventana de análisis y estado nuevo debe caber en el presupuesto de CPU y retardo ya establecido.

### Referencias de comportamiento

Waves Tune Real-Time es la referencia sonora principal para las comparaciones de naturalidad. Su documentación distingue Speed, Note Transition y Tolerance y describe tratamiento del vibrato y conservación de formantes. Antares Artist documenta Humanize para ralentizar la corrección en partes sostenidas y Flex-Tune para permitir gestos fuera de la zona cercana al objetivo. [S13] [S14]

EASY PITCH toma esos comportamientos como referencias de evaluación y define su propia coordinación interna. Los manuales no especifican íntegramente sus motores propietarios. No declarar equivalencia sonora por implementar controles parecidos. Las comparaciones deben usar la versión y configuración concretas de cada producto, con un nivel de corrección comparable.

### Transformación del audio y timbre

El transformador debe cambiar altura sin cambiar la duración global. Evaluar conservación del timbre y formantes, ataques, consonantes y continuidad de fase. En estéreo se aplica una trayectoria musical común a los dos canales, preservando coherencia; no se afinan como cantantes distintos.

Para controlar una entrada estéreo monofónica, elegir una señal de análisis robusta. Una suma L más R puede cancelar componentes en señales invertidas; comparar canales y definir selección con histéresis. El layout estéreo no implica soporte para dos voces distintas simultáneas.

La ruta de consonantes y la ruta afinada deben compartir el mismo reloj y retardo. Una transición hacia original necesita alineación antes del crossfade; de otro modo puede crear comb filtering. Conservar timbre no significa copiar el original en paralelo ni dejar intactos todos sus detalles espectrales.

### Alineación temporal

Cada estimación debe aplicarse al audio del que procede. Documentar la posición de la ventana de análisis, el punto donde se calcula el control, el tiempo de procesamiento del shifter y la posición de salida. El retardo total se deriva de esa línea temporal, teniendo en cuenta buffers que se solapan; no sumar o restar latencias a ciegas.

Al hacer seek, cambiar sample rate, iniciar transporte o vaciar el procesador, reinicializar estados de forma coherente. El final de un render debe conservar la última sílaba: probar vaciado y compensación, no cortar el contenido retenido en buffers. No añadir una cola artificial de reverb.

## 7 Análisis de tecnologías y decisiones de la IA

La selección se realiza en un banco de pruebas separado de la UI. Evaluar al menos dos rutas viables con el mismo corpus, rango de corrección, sample rate y presupuesto de latencia. Elegir primero el comportamiento y después cerrar las dependencias.

| Ruta | Uso en la evaluación | Decisión que necesita evidencia |
|---|---|---|
| YIN causal con seguimiento | Base para detección monofónica | Precisión, octavas y respuesta en voz real |
| Candidatos tipo pYIN con espera acotada | Alternativa para seguimiento | Si mejora estabilidad sin demorar demasiado |
| Motor monofónico de tipo TD PSOLA | Candidato de transformación vocal | Marcas de periodo, transiciones y artefactos |
| Signalsmith Stretch | Referencia espectral integrable | Latencia y calidad de cambios rápidos |
| Rubber Band LiveShifter | Comparación adicional si procede | Demora documentada y condiciones de licencia |

Signalsmith ofrece cambio de pitch, compensación de formantes y latencias de entrada/salida. Su documentación distingue el tiempo de procesamiento del tiempo de entrega y señala límites de su compensación de formantes. Es una base de evaluación, no una elección cerrada para grabación. [S3]

Rubber Band LiveShifter devuelve bloques con igual número de muestras, pero su documentación indica un retardo de 50 ms o más según configuración. Esto no cumple el objetivo de monitorización propuesto para EASY PITCH. La biblioteca publica condiciones GPL y una licencia comercial para integración propietaria. [S4] [S5]

La documentación de Praat describe resíntesis mediante overlap add sincronizado con periodos. Sirve como referencia conceptual para investigar PSOLA; no constituye un SDK de plugin listo ni autoriza a copiar código sin revisar su licencia. [S6]

La IA debe registrar: versión o commit de cada dependencia, licencia del código realmente utilizado, configuración, latencia medida, coste de CPU, limitaciones y motivo de elección. Una implementación desde un artículo y copiar su implementación pública son decisiones diferentes. Preferir costes operativos nulos y dependencias redistribuibles compatibles; no asumir que todos los proyectos abiertos sirven para un producto cerrado.

Si ninguna ruta cumple calidad y monitorización, el resultado correcto es identificar el bloqueo y mejorar el motor. No ocultar una demora alta, bajar los objetivos sin indicarlo ni publicar Grabar como etiqueta de un algoritmo sin verificar. Un producto solo para mezcla sería una decisión de alcance posterior.

## 8 WebView y arquitectura de integración

La interfaz principal se implementa con HTML y CSS en WebView, respetando la preferencia de OFFSZN. El DSP se ejecuta en el procesador nativo del plugin. La IA elige la versión adecuada de JUCE, integración WebView2, herramientas de frontend y empaquetado según el proyecto, evitando introducir frameworks innecesarios.

Separar responsabilidades: estado musical, detección y seguimiento, selección de notas, transformación, parámetros del host, presets y presentación. El editor puede destruirse sin destruir la mezcla. El estado de C++ es la autoridad; localStorage solo puede contener preferencias visuales prescindibles.

La documentación de JUCE permite configurar integración nativa y suministro local de recursos para WebBrowserComponent. La implementación debe comprobar qué API existe en la versión fijada, sin copiar ejemplos de master suponiendo compatibilidad. [S7]

### Contrato del puente

Usar IDs permitidos, valores tipados y unidades inequívocas. Validar rangos, NaN, infinito y mensajes obsoletos en nativo. Cada gesto manual inicia y termina una edición para el host. Al abrir la UI recibir un snapshot completo; después usar cambios con revisión y acuse. La automatización del DAW debe actualizar la pantalla sin originar bucles de notificación.

Los medidores se actualizan a una frecuencia visual limitada, propuesta de 20 a 30 Hz. Nunca transmitir audio por muestra a JavaScript. Si la UI se demora, se descartan actualizaciones visuales antiguas; no se bloquea el proceso de audio.

### Funcionamiento local y ventanas

Distribuir HTML, CSS, JS, fuentes e iconos con el plugin. Sin CDN ni página web remota como interfaz de emergencia. Detectar runtime ausente antes de abrirlo cuando sea posible; la recuperación no debe descargar nada ni abrir navegadores durante el escaneo del DAW.

WebView2 exige un hilo STA con bombeo de mensajes. La IA debe respetar el modelo de hilos del host y JUCE, manejar fallos de COM y equilibrar solo la inicialización que le corresponde. Crear un control WebView en cualquier worker no resuelve el problema. [S8]

Definir el entorno y las carpetas de datos de WebView para múltiples instancias y hosts, comprobando su política de procesos. Una carpeta por producto no significa aislamiento por instancia; tampoco es obligatorio duplicar un runtime entero por editor. Probar permisos, cierre y cachés activas antes de elegir. [S9]

Cancelar callbacks al cerrar, usar referencias de vida seguras y detener timers. Un fallo visual debe dejar el audio y los parámetros de sesión funcionando. No modificar archivos de interfaz mientras una instancia los usa sin un mecanismo de actualización versionada.

## 9 Rendimiento y compatibilidad profesional

El procesamiento de audio tiene plazo por bloque. No hacer red, disco, parseo JSON, logs, bloqueos, asignaciones de memoria ni inicialización de modelos dentro de ese recorrido. Preasignar buffers y comprobarlo también en dependencias. Usar workers solo con una estrategia de plazos y cola acotada; no entregar corrección atrasada si un worker no termina.

### Latencia

Separar tres mediciones: retardo de audio agregado por el plugin; tiempo que tarda en adquirir una nota fiable; tiempo que tarda la corrección en llegar al objetivo. La latencia de interfaz y buffer ASIO se informa aparte.

Objetivo de lanzamiento para monitorización: retardo fijo del plugin de hasta 10 ms a 48 kHz en la configuración anunciada. La adquisición de una nota grave puede tardar más que ese retardo. Una ventana de análisis causal puede mirar muestras pasadas; su longitud no se debe presentar automáticamente como latencia añadida, pero sí influye en adquisición y respuesta.

Mantener latencia estable con Rapidez, Cantidad y Rango de voz. Reportarla al host y alinear el bypass. La compensación del DAW alinea pistas, pero no elimina lo que siente el cantante al monitorizar. Si el motor necesita otra configuración de calidad/latencia, se documenta y prueba antes de introducir un selector nuevo. [S10]

### Plataformas y sesiones

Lanzamiento objetivo: Windows x64 VST3. Validación principal con FL Studio 25 y Ableton Live 11 disponibles, anotando versión exacta, Windows y driver. Probar layouts mono a mono y estéreo a estéreo. No anunciar AU, macOS, Linux o compatibilidad universal hasta probar sus binarios.

Sample rates de aceptación: 44.1, 48 y 96 kHz. Bloques: 32, 64, 128, 256, 512 y 1024 muestras donde el host permita configurarlos; añadir bloques vacíos, impares y de tamaño variable en el banco de pruebas. El sonido musical no debe depender de que el bloque coincida con la ventana del detector.

Guardar todos los parámetros musicales y el esquema en la sesión del host. Persistir también cambios realizados con el editor cerrado. Restaurar una versión anterior mediante migración explícita. No serializar punteros, handles de WebView ni buffers de voz como si fueran presets.

Exportación offline y reproducción deben usar el mismo comportamiento seleccionado; no cambiar a un algoritmo secreto de mayor calidad solo al exportar. Se acepta ruido numérico pequeño definido por la implementación, no decisiones de nota diferentes sin explicación.

## 10 Pruebas y criterios de aceptación

Definir un corpus de evaluación versionado antes de calibrar. Incluir señales sintéticas con F0 conocido y tomas vocales consentidas: graves, medias, agudas, aireadas, rasposas, notas cortas, vibrato, slides y consonantes. Incluir silencios, ruido y entradas difíciles como pruebas negativas. Separar clips de ajuste de clips de validación.

No usar el mismo detector del producto como único juez de su propia salida. Usar referencias conocidas, anotaciones auditadas y un método independiente. Alinear las mediciones por tiempo. Separar detección, elección de objetivo y error del audio final, evitando que un promedio esconda fallos de octava.

### Objetivos medibles iniciales

Son metas de ingeniería propuestas para la primera versión. Deben fijarse antes del ajuste final y no presentarse como un benchmark ya alcanzado.

| Prueba | Meta inicial | Condición de medición |
|---|---|---|
| Escalas | 100 por ciento de combinaciones correctas | Doce keys, dos escalas y fronteras entre notas |
| Seguimiento limpio | Al menos 95 por ciento dentro de 25 cents | Frames sonoros anotados; reportar también cobertura |
| Errores de octava | Menos de 0.5 por ciento | Corpus limpio, errores identificados aparte |
| Voz afinable | Recall de voz al menos 95 por ciento | Tramos anotados como afinables |
| Falsos objetivos | Máximo 1 por ciento | Tramos negativos anotados como no afinables |
| Afinación sostenida | Mediana hasta 5 cents y p95 hasta 15 | Cantidad 100, Rapidez máxima, 200 ms tras onset o cambio |
| Cantidad cero | Original alineado; residual RMS bajo −120 dBFS | Float, ganancia unitaria, después de transición |
| Silencio | Sin notas ni salida generada | Buffers internos vacíos |
| Retardo agregado | Hasta 10 ms | 48 kHz y configuración de monitorización validada |
| Seguridad de ejecución | Cero NaN, Inf, crashes o accesos inválidos | Batería de host y banco automatizado |

Para ataques, medir aparte adquisición y respuesta p50/p95 desde un onset o cambio anotado. Primer objetivo de p95: 50 ms a partir de 100 Hz y 80 ms entre 65 y 100 Hz con el perfil más rápido; revisar viabilidad con el prototipo y documentar el resultado. No excluir onsets para afirmar que toda la actuación tiene el error de las notas sostenidas.

Para CPU, registrar tiempo por bloque, no solo porcentaje del Administrador de tareas. En el equipo de referencia, objetivo de p99.9 inferior al 25 por ciento del plazo de un bloque en prueba de una instancia. Probar ocho instancias con UI cerrada y después abiertas, con 30 minutos de reproducción, sin cortes atribuibles al plugin. Registrar hardware, buffers, carga de fondo y eventuales fallos.

### Evaluación auditiva

Comparar original y procesado a nivel equivalente, y con un afinador de referencia disponible legítimamente. No igualar posiciones de perillas entre marcas suponiendo que significan lo mismo. Evaluar naturalidad en Suave y precisión/ataques en Marcado.

Buscar voz metálica, granulado, duplicación, bombeo de timbre, clicks, consonantes degradadas y cambios de nivel. Usar al menos tres oyentes en beta y registrar clip, instante, configuración y severidad. Un defecto severo reproducible en el uso soportado bloquea la salida aunque las métricas agregadas sean buenas.

### Pruebas de naturalidad sin controles adicionales

Evaluar una cuadrícula de Rapidez 0, 35, 65 y 100 con Cantidad 0, 50 y 100. Son puntos iniciales de prueba, no nuevos presets ni modos. Documentar para cada combinación el centro de afinación, el tiempo de llegada, el movimiento conservado y los defectos audibles. La meta de error instantáneo de la tabla anterior corresponde al extremo marcado; en Suave se evalúan por separado el centro y la oscilación para no penalizar el vibrato que se quiere conservar.

- Centro y vibrato: generar una vocal sintética con centro 30 cents bajo el objetivo y vibrato de 6 Hz con amplitud de 20 cents. Medir tras estabilizarse si sube el centro y qué amplitud y frecuencia conserva. Fijar los márgenes de aceptación con el prototipo antes de la beta; una simple reducción de Cantidad no demuestra esta función.
- Nota larga y frase rápida: alternar ambas en el mismo clip. Verificar expresión durante la nota larga y adquisición de la siguiente nota sin arrastre del estado anterior.
- Deslizamiento y cambio real: comparar un portamento, una desviación breve y dos notas claramente sostenidas. El objetivo debe ser estable sin bloquear el cambio real; registrar cuándo se toma cada decisión.
- Consonantes y voz aireada: verificar continuidad al pasar entre zonas afinables y no afinables. La presencia de aire no debe desactivar automáticamente una vocal que sí mantiene altura fiable.
- Recorrido de controles: automatizar Rapidez y Cantidad en ambos sentidos. No debe haber umbrales audibles de cambio de modo, clics, saltos de retardo ni diferencias al introducir el mismo valor por UI o por el host.

Usar Waves Tune Real-Time como referencia principal y Antares como referencia adicional cuando esté disponible. Conservar renders identificados de original, referencia, versión estable de EASY PITCH y candidata. Realizar escucha a ciegas a nivel equivalente, separando afinación, naturalidad, timbre, articulación y comodidad al monitorizar. La preferencia por una muestra que apenas corrige no basta para aprobar la mejora.

### Escenarios obligatorios del host

Abrir y cerrar editor 100 veces; borrar instancia durante reproducción; restaurar proyecto; automatizar cada parámetro; cambiar Key mientras se reproduce; pasar por Cantidad cero; comparar original y perder foco; cambiar sample rate; hacer seek y loops; render offline; cortar al final de una frase; abrir dos hosts y varias instancias; iniciar sin internet; fallar WebView sin interrumpir audio.

Usar pluginval y herramientas del SDK como comprobación adicional. pluginval ofrece pruebas automatizadas de plugins, pero no sustituye escucha ni validación en FL Studio y Ableton. [S11]

## 11 Riesgos y decisiones pendientes

| Riesgo | Consecuencia | Respuesta requerida |
|---|---|---|
| Motor con demasiada demora | Monitorización incómoda | Medir antes de comprometer la biblioteca |
| Seguimiento confundido por armónicos | Octavas erróneas | Candidatos, rango y casos de validación específicos |
| Exceso de estabilidad | Notas rápidas no se siguen | Medir transiciones además de notas sostenidas |
| Formantes mal conservados | Voz artificial involuntaria | Comparación vocal y ajuste del transformador |
| Corrección aplicada tarde | Ataques de sílabas incorrectos | Contrato temporal por muestras |
| Key incorrecta o cambio armónico | Objetivos válidos pero no deseados | Selección visible y automatización de Key/Escala |
| Dependencia incompatible | Distribución bloqueada | Revisión de licencia y versión antes de integrarla |
| UI inestable | Riesgo de cierre del host | Lifecycle, varios editores y fallback controlado |

Decisiones a resolver por la IA: detector y seguimiento; transformador; curva de Rapidez; rangos finales; estrategia de consonantes; referencia de hardware; versión JUCE; frontend; bridge; entorno WebView; sistema de build e instalador. Cada decisión necesita una nota breve con alternativas, evidencia y consecuencias de mantenimiento.

La política comercial, precio, trial y activación se definen aparte. El prototipo DSP no debe requerir inventar un servidor de licencias. Si se integra el sistema OFFSZN existente, se verifica en nativo y no bloquea audio por consultar la red. No copiar validación basada únicamente en prefijos de una clave o en un booleano enviado desde JavaScript. Las condiciones vigentes de JUCE y de todas las dependencias deben verificarse para la versión distribuida. [S12]

## 12 Proceso de construcción y entrega

La IA avanza por los pasos siguientes. Cada paso entrega una evidencia concreta antes de depender de él en el siguiente. Las decisiones rutinarias se resuelven durante el desarrollo; los incumplimientos se registran con una alternativa verificable.

### Paso 1 Fijar controles y preparar referencias

Cerrar el contrato de Key, Escala, Rapidez, Cantidad y los ajustes de Personalizar existentes. Preparar un banco inicial de unas 20 frases representativas y señales sintéticas con altura conocida. Conservar los ajustes favoritos de Waves como referencia y registrar versiones, parámetros y sample rate. Entregar el esquema de estado, los clips y los criterios de comparación. El banco se amplía cuando aparece un fallo concreto.

### Paso 2 Validar seguimiento y objetivos

Implementar detección, confianza, distinción entre zonas afinables y no afinables y elección de notas permitidas. Medir errores de octava, fronteras de escala y recuperación tras silencios. Entregar trazas alineadas con los clips y resultados de las doce tonalidades en ambas escalas. Resolver errores de objetivo antes de atribuirlos al transformador de audio.

### Paso 3 Construir la primera ruta de audio

Comparar las rutas viables del transformador con detección y objetivos ya controlados. Completar timbre, consonantes, original alineado y Cantidad cero. Medir retardo, adquisición y tiempo de corrección por separado. Entregar audio procesado y evidencia de viabilidad; elegir y fijar dependencias a partir de ese resultado. Esta versión queda como referencia para detectar regresiones.

### Paso 4 Integrar naturalidad por partes

Trabajar en este orden: transiciones entre objetivos; separación de centro y vibrato; respuesta durante notas largas. Activar cada mejora por separado en el banco de desarrollo, comparar contra la referencia anterior y conservar solo los cambios que superen sus pruebas. Entregar un registro de qué cambió, en qué clips mejoró y qué limitaciones quedan. Las opciones de diagnóstico no forman parte de la UI distribuida.

### Paso 5 Calibrar los controles existentes

Unificar los comportamientos internos con curvas continuas de Rapidez y aplicar Cantidad al final de la trayectoria musical. Calibrar Suave, Firme y Marcado como combinaciones reproducibles de esos controles. Entregar la tabla de curvas y las pruebas de recorridos, extremos y equivalencia entre preset y ajuste manual. La configuración aprobada del motor se fija con una revisión identificable.

### Paso 6 Conectar WebView y sesiones

Implementar la pantalla definida, Personalizar, presets, comparación, automatización y restauración. El procesador nativo conserva la autoridad sobre audio y estado. Entregar el flujo completo de abrir, elegir key, afinar, guardar, cerrar y recuperar, con el mismo sonido también cuando el editor está cerrado.

### Paso 7 Validar la beta y proteger el sonido

Ejecutar las pruebas de las secciones 9 y 10 en FL Studio y Ableton, incluida escucha comparada con las referencias. Entregar resultados de precisión, naturalidad, CPU, retardo, automatización y compatibilidad. Un fallo crítico reproducible bloquea el lanzamiento aunque el promedio sea bueno.

Para cambios musicales posteriores, conservar una versión de referencia y comparar la candidata con el mismo banco. Guardar una revisión del comportamiento del motor en el estado del proyecto y en los presets del usuario; es metadato interno, no una perilla. Mantener la compatibilidad de sesiones antiguas mediante el comportamiento anterior o una migración validada. No sustituir silenciosamente el sonido de un proyecto por una nueva calibración.

### Paso 8 Empaquetar y entregar

Preparar instalador con prerrequisitos claros; binario en la carpeta VST3 correcta; desinstalador fuera del bundle; assets accesibles al usuario que abre el DAW. Preservar presets y licencias al actualizar o reinstalar. Comprobar instalaciones elevadas y cuentas de usuario distintas. No borrar carpetas de otros productos como limpieza genérica.

Entregar código, dependencias fijadas, instrucciones de build, binarios disponibles, resultados de pruebas, manual breve en español, avisos de terceros, notas de versión y procedimiento de actualización. Firma de código o certificados faltantes se identifican como tarea concreta; nunca declarar firmado un instalador que no lo está.

### Definición de terminado

EASY PITCH está listo cuando una voz individual se afina hacia la escala elegida, Rapidez y Cantidad tienen un efecto consistente, la naturalidad integrada supera sus pruebas, el timbre y las consonantes pasan la escucha, el retardo cumple el uso anunciado y la sesión se restaura correctamente. Cada control visible debe estar conectado al motor. Ningún criterio crítico puede quedar sustituido por una animación, un stub o la afirmación de que compiló.

## 13 Funciones futuras

La coordinación básica de transiciones, vibrato y notas largas pertenece al motor del lanzamiento. Su perfeccionamiento continúa después sin exigir controles nuevos. El resto de funciones siguientes son posibilidades futuras, fuera del alcance cerrado de la primera versión. Cada incorporación exige pruebas de regresión y una razón de uso concreta.

| Prioridad | Función | Valor para el usuario | Ubicación propuesta |
|---|---|---|---|
| Próxima | Notas permitidas con teclado de doce notas | Excluir objetivos y resolver excepciones | Personalizar |
| Próxima | Menor armónica y Cromática | Cubrir más material musical | Escala |
| Próxima | Mejorar la clasificación de gestos | Conservar expresión en interpretaciones más difíciles | Mejora interna |
| Próxima | A y B con copia entre estados | Comparar dos ajustes de afinación | Menú compacto |
| Posterior | Calidad para mezcla si aporta mejora medida | Mejor timbre con mayor procesamiento | Personalizar |
| Posterior | Objetivos MIDI | Control explícito de la melodía de destino | Modo opcional |
| Posterior | AU y macOS | Ampliar usuarios | Binarios propios probados |
| Posterior | Tema claro y mejor accesibilidad | Adaptar la visualización | Ajustes de interfaz |
| Investigación | Seguimiento mejorado para voces difíciles | Menos errores de octava y pérdidas | Mejora interna |
| Investigación | Edición gráfica o integración ARA | Corregir frases concretas manualmente | Proyecto separado de alcance |

Notas permitidas deberá definir máscara vacía, una sola nota, transposición por key y restauración al cambiar escala. Las futuras mejoras del vibrato y las notas largas mantendrán la coordinación con Rapidez y la compatibilidad de sesiones. MIDI exige definir cuándo una nota entrante es objetivo, qué sucede al soltarla y cómo se trata la polifonía. La calidad de mezcla nunca cambiará silenciosamente entre reproducción y render.

Menor melódica requiere definir si se aplica una colección fija de notas o un comportamiento contextual; no añadirla como nombre sin semántica. Los detectores neuronales solo se considerarían si mejoran resultados con coste y latencia aceptables. Ninguna función futura requiere convertir el producto en asistente conversacional.

## 14 Instrucción para la IA de desarrollo

Desarrolla EASY PITCH siguiendo este PRD como contrato de producto. Es un afinador vocal independiente con Key manual, escalas Mayor y Menor natural, Rapidez y Cantidad. Mantén los nombres simples y la interfaz compacta en WebView. Personalizar conserva Rango de voz, Conservar timbre y Referencia.

Implementa transición entre notas, conservación del vibrato y adaptación a notas largas dentro del motor, coordinadas mediante Rapidez y la voz analizada. Cantidad regula el desplazamiento musical final. No añadas controles ni modos para estas mejoras. Los presets de fábrica son combinaciones de parámetros públicos y no seleccionan algoritmos secretos. Sigue los ocho pasos de la sección 12 y entrega evidencia de cada uno.

Elige e implementa las tecnologías que mejor cumplan calidad de audio, latencia, estabilidad y distribución. Antes de decidir el motor, construye un banco de pruebas y compara rutas viables. No interpretes referencias a YIN, PSOLA o bibliotecas como una orden de integrarlas todas. Registra las decisiones y fija versiones.

Avanza por las etapas del PRD, resuelve elecciones rutinarias y no te detengas en un mockup. No añadas funciones fuera del alcance para compensar problemas del DSP. Separa funciones implementadas, verificadas y pendientes. No inventes precisión, compatibilidad, mediciones, certificados ni acceso a servicios. Si un requisito es incompatible con la tecnología elegida, muestra el problema y propone una alternativa concreta.

Usa infraestructura existente de OFFSZN cuando sea estable y compatible con este producto. El audio debe funcionar sin red, sin editor y sin dependencia de Vocal Preset. Termina con archivos reproducibles y evidencia de las pruebas del afinador real.

## 15 Fuentes de apoyo

Las fuentes sustentan decisiones técnicas o límites indicados en el texto. La selección de funciones, UI, valores iniciales y metas de aceptación son propuestas específicas para EASY PITCH. Documentación consultada el 19 de septiembre de 2026; contrastar las APIs con las versiones fijadas en el proyecto.

- [S1 Antares AutoTune Best Practices](https://help.antarestech.com/hc/en-us/articles/42858099043092-AutoTune-2026-Best-Practices). Flujo de key y escala, corrección y posición en la cadena.
- [S2 Mauch y Dixon pYIN](https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2014/MauchDixon-PYIN-ICASSP2014.pdf). Candidatos de frecuencia y seguimiento temporal.
- [S3 Signalsmith Stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch). API, latencia, automatización y formantes.
- [S4 Rubber Band LiveShifter](https://www.breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandLiveShifter.html). Bloques, seguridad de procesamiento y retardo documentado.
- [S5 Rubber Band distribución](https://www.breakfastquay.com/rubberband/index.html). Condiciones públicas de uso y licencia comercial.
- [S6 Praat overlap add](https://www.fon.hum.uva.nl/praat/manual/overlap-add.html). Referencia de resíntesis sincronizada con periodos.
- [S7 JUCE WebBrowserComponent Options](https://docs.juce.com/master/classjuce_1_1WebBrowserComponent_1_1Options.html). Integración nativa y recursos de interfaz.
- [S8 Microsoft WebView2 threading](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model). Hilo STA y ciclo de mensajes.
- [S9 Microsoft WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model). Entornos, procesos y carpetas de datos.
- [S10 JUCE AudioProcessor](https://docs.juce.com/master/classjuce_1_1AudioProcessor.html). Latencia, estado, procesamiento y contrato con el host.
- [S11 Tracktion pluginval](https://github.com/Tracktion/pluginval). Validación automatizada de plugins.
- [S12 JUCE licencias](https://juce.com/get-juce/). Modalidades y condiciones que deben comprobarse para distribuir.

- [S13 Waves Tune Real-Time](https://www.waves.com/plugins/waves-tune-real-time). Controles documentados y referencia de comportamiento para la comparación auditiva.
- [S14 Antares Auto-Tune Artist User Guide](https://antares-web-frontend.sfo3.cdn.digitaloceanspaces.com/documentation/pdfs/Auto-Tune_Artist_Manual.pdf). Humanize, Flex-Tune, vibrato y comportamiento de afinación.
