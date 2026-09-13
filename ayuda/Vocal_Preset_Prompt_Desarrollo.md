# PROMPT MAESTRO — OFFSZN VOCAL PRESET

Adjunta este documento junto con la skill `juce-plugin-creator` y el repositorio del plugin. Este documento define el producto específico y resuelve las contradicciones de los ejemplos de esa skill. No es una modificación de la skill original.

## 1. Tu tarea y resultado esperado

Actúa como desarrollador de plugins C++/JUCE, DSP vocal e interfaces HTML/CSS/JS integradas con WebView. Implementa OFFSZN Vocal Preset: un plugin de mezcla y efectos vocales que se controla mediante comandos de voz locales, texto y controles manuales. Entrega código funcional, compilable y conectado; no una interfaz que simule procesamiento.

Lee primero la skill adjunta y el código existente. Reutiliza la infraestructura comprobada del proyecto. Documenta decisiones técnicas y avanza por etapas sin pedir confirmación para elecciones rutinarias. Si faltan SDK, certificados, credenciales o un entorno de prueba, indica exactamente qué no se pudo verificar; no inventes resultados ni endpoints.

Prioridad: Windows x64 VST3 con JUCE y WebView2. Conserva la versión JUCE compatible con el repositorio y fija versiones de dependencias. Diseña separación multiplataforma para macOS/WKWebView y AU, pero no declares soporte macOS sin compilar y probar. Fabricante `Ofsz`; propone `VcPr` como código del producto, comprobando antes que no exista en el catálogo/repositorio.

## 2. Concepto cerrado del producto

El usuario mantiene pulsado “Hablar”, dice “pon chorus suave”, suelta y el plugin aplica una receta determinista. Puede retocar el efecto en una tarjeta compacta. El plugin no conversa, no usa LLM, no consulta servicios de IA, no cobra créditos y no sintetiza respuestas habladas.

Usa reconocimiento de voz a texto local —STT—, no TTS. La inferencia de STT es local; el control de efectos es un parser de reglas. No implementar Web Speech API como dependencia de reconocimiento, pues no es la garantía de funcionamiento offline requerida. La UI WebView es la presentación; el DSP y el reconocimiento viven en nativo.

Si no entiende una orden, no cambia nada y muestra “No reconocido. Prueba: chorus suave”. No abre un diálogo de preguntas. Las órdenes claras se aplican directamente con Deshacer disponible. Para ambigüedad sin contexto usa un mensaje breve y ejemplos; nunca adivines un módulo.

El alcance incluye una base de mezcla y ocho módulos: EQ/filtros, compresión, de-esser, saturación, doubler, chorus, delay y reverb. No incluye afinación automática, clonación, generación de audio, hosting de VST de terceros, marketplace, landing, checkout ni cambios al servidor de producción. Estos últimos capítulos de la skill no forman parte de esta implementación.

## 3. Interfaz WebView: requisito obligatorio

Mantén HTML/CSS/JS en WebView2. No sustituyas la interfaz principal por controles JUCE nativos. JUCE nativo puede mostrar un aviso mínimo de recuperación si WebView no arranca, mientras el procesamiento conserva su estado.

Diseño: compacto, elegante, fondo carbón, texto blanco, grises y verde OFFSZN discreto. Sin robot, burbujas de chat, partículas, brillos grandes, decoraciones gratuitas ni 30 perillas visibles. Todos los textos del producto en español, conservando nombres habituales como Chorus, Delay y Doubler.

Tamaño inicial propuesto 960 × 620 píxeles lógicos; permitir escalado controlado 80/100/125/150% y probar DPI, límites de ventana y legibilidad. No confundir bloqueo del zoom accidental del navegador con impedir escalado accesible.

Distribución:
- Cabecera: Vocal Preset, preset actual, selector Inserto/Envío, guardar y ajustes.
- Zona central: “¿Qué efecto quieres?”, botón “Mantén para hablar”, estado de escucha, pequeña indicación de nivel real de entrada y campo “O escribe un comando”.
- Ejemplos pulsables: Chorus suave, Doubler ancho, Reverb oscura, Delay corto. Ejecutan el mismo parser.
- Debajo: última instrucción y resultado concreto, no historial de conversación.
- Rack compacto: módulos activos; cada tarjeta tiene nombre, activar/desactivar y macro Cantidad. Al seleccionar, abre tres controles principales. Avanzado muestra el resto.
- Pie: Deshacer/Rehacer, A/B, nivel de salida, medidores y aviso de clipping.
- Panel de comandos con búsqueda y categorías, generado desde el mismo catálogo que usa el parser.

Personalización inicial: fijar controles favoritos, ocultar tarjetas desactivadas, elegir escala y reordenar visualmente tarjetas. El orden visual NO altera el ruteo DSP. No añadir un editor libre de grafos en v1.

Estados explícitos: listo, cargando reconocimiento, escuchando, interpretando, aplicado, no reconocido, entrada ausente, reconocimiento no disponible. No mostrar actividad inventada ni “aplicado” hasta tener acuse del motor.

## 4. Recursos locales y estabilidad WebView

HTML, JS, CSS, iconos y fuentes se distribuyen localmente. Nada de CDN, fuentes remotas ni página web de fallback. Mantén la carpeta local OFFSZN de la skill cuando sea compatible con el proyecto; recupera archivos faltantes desde recursos empaquetados de la misma versión. Haz escrituras/versionado de assets fuera del audio thread y evita carreras entre instancias. Si usas resource provider local de JUCE, documenta la adaptación y comprueba la versión instalada.

No abras navegador ni descargues runtime durante escaneo de plugins. Detecta WebView2 ausente y permite que el instalador o una acción explícita resuelva el prerrequisito. No prometas apertura de latencia cero.

WebView2 requiere un hilo STA con bombeo de mensajes. No copies sin más `CoInitializeEx` del ejemplo: comprobar HRESULT, tratar `RPC_E_CHANGED_MODE`, equilibrar cada inicialización propia exitosa, incluido S_FALSE, con CoUninitialize en el mismo hilo y con objetos ya destruidos. No desmontar COM inicializado por el host. Respetar la integración real de JUCE y no mover componentes JUCE arbitrariamente a otro hilo.

Definir una política de user-data-folder compatible con WebView2. Una carpeta por producto no equivale a aislamiento por instancia. Para v1 se propone carpeta por proceso del host, entorno coherente dentro del proceso y limpieza diferida de carpetas antiguas que no estén en uso. Validar múltiples instancias y dos hosts simultáneos; ajustar según resultados, sin borrar cachés activas.

Detener timers, desconectar listeners y cancelar callbacks al cerrar. Proteger callbacks asíncronos con SafePointer o tokens de vida apropiados. El editor no debe poseer el estado DSP. Cerrar/reabrir la UI no reinicia efectos ni presets. El puente solo acepta mensajes tipados y rutas/acciones permitidas; navegación remota bloqueada. Permitir seleccionar y pegar texto en campos aunque el resto de la UI use user-select:none.

## 5. Reconocimiento local y captura de comandos

Implementar `ISpeechRecognizer` y comenzar con Vosk y un modelo español pequeño compatible. Fijar versión, checksum, licencia del modelo y avisos redistribuibles. Validar vocabulario antes de asumir que una gramática permite palabras ausentes del modelo. Probar “chorus/corus”, “doubler/doblador”, “reverb/reverberación” y “delay/eco”.

No integrar dos motores en v1. Si Vosk falla claramente en el corpus de aceptación, registrar la evidencia y evaluar whisper.cpp multilingüe detrás de la misma interfaz. No usar modelos solo ingleses para español. No afirmar precisión ni tiempo de respuesta sin medirlos.

Carga diferida del modelo al activar la función de voz, nunca en processBlock ni escaneo del host. Compartir recursos inmutables cuando la API lo permita; sesiones de reconocimiento independientes. Limitar a una escucha activa por proceso y dirigir el resultado al instanceId y commandId originales. No entregar órdenes atrasadas a otra instancia o a una nueva sesión.

Fuente principal de v1: entrada que recibe el plugin del DAW, antes del DSP. El usuario debe enrutar su micrófono a esa entrada. No abrir automáticamente otro dispositivo ASIO. Si el host no entrega audio, mostrar “Activa la entrada de micrófono en esta pista”. No afirmar que el plugin puede forzar al DAW a procesar estando parado.

Añadir un bus auxiliar opcional “Command Input” si el wrapper/host lo admite. Si está conectado y seleccionado, escuchar ese bus; no mezclarlo en la salida musical. Mostrar configuración simple “Entrada de pista / Entrada de comandos”. Probar el bus en cada host; no anunciar compatibilidad universal. Esto permite reproducir una voz grabada en la entrada principal y hablar por una entrada distinta.

Si el usuario usa la misma entrada para música y comandos, explicar una sola vez que ambos pasan por esa pista. No silenciar la salida ni alterar la grabación automáticamente. No prometer separación entre voz hablada, canto y música en una misma señal.

Push-to-talk mediante pointer capture; cancelar en pérdida de foco/cierre, finalizar al soltar. Botón alternativo iniciar/detener para accesibilidad. No interceptar la barra espaciadora del DAW globalmente. Límite inicial 8 segundos y detección de silencio. Copiar audio a FIFO preasignada; resamplear y reconocer en worker según formato requerido por el modelo. Si la FIFO se llena, abortar la captura con aviso; jamás bloquear audio. No guardar ni transmitir grabaciones de comandos.

## 6. Parser y contrato determinista

Ruta compartida: voz transcrita / texto / ejemplo pulsable → normalización → parser → validación → transacción → parámetros → acuse UI.

Normalizar mayúsculas, tildes, puntuación, números hablados y coma decimal sin perder negaciones ni unidades. Sin coincidencias por substring peligrosas. “No pongas reverb” no puede activar reverb; en v1 las negaciones no contempladas se rechazan completas. Admitir conjunciones para varias operaciones. Si una parte no se interpreta, rechazar la orden completa para evitar aplicar la mitad sin avisar.

Gramática:
- Acciones: activar/poner/agregar, quitar/desactivar, subir/bajar, establecer, deshacer/rehacer.
- Efectos: alias registrados por módulo.
- Cantidad: suave, medio, fuerte; valor explícito con unidad; más/menos.
- Características específicas: oscuro/brillante/corto/largo para reverb; lento/rápido para chorus; ancho/estrecho para doubler; tiempo y repeticiones para delay.
- Contexto: módulo seleccionado explícitamente o único módulo mencionado en la última orden aplicada. Limpiar el contexto al cargar preset. Si falta, rechazar “más lento” con ejemplo concreto.

Semántica:
- “Pon chorus” habilita el módulo y restaura su último ajuste; si nunca se editó usa receta inicial.
- “Chorus suave” aplica la receta suave documentada de ese módulo.
- “Más chorus” suma 5 puntos porcentuales a su cantidad.
- “Chorus al 20 por ciento” establece cantidad absoluta, no suma.
- “Quita chorus” desactiva sin destruir sus ajustes.
- “Doubler más ancho” cambia solo anchura.
- “Reverb oscura y corta” cambia tono y decay, no compresor ni volumen directo.
- “Menos repeticiones” reduce feedback del delay 5 puntos.
- “Delay a corchea” selecciona sync 1/8.
- “Reverb a dos segundos” cambia decay físico a 2 s.
- “Deshacer” revierte una orden completa; no deshace cambios posteriores ajenos accidentalmente.
- Órdenes contradictorias sobre el mismo parámetro se rechazan completas.
- Pedidos no implementados como “hazme sonar como X” se rechazan sin fingir entendimiento.

Ejemplo de contrato interno, con valores físicos y validación por registro:
```json
{
  "schemaVersion": 1,
  "commandId": "unique-command-id",
  "instanceId": "target-instance",
  "source": "voice",
  "operations": [
    {"type": "enable", "module": "chorus", "value": true},
    {"type": "set", "parameter": "chorus.amount", "value": 20, "unit": "%"}
  ]
}
```

Solo acciones y parámetros de allowlist; rechazar NaN, infinito, unidades incompatibles, payload excesivo y valores absolutos fuera de rango. Incrementos relativos se limitan al rango y muestran el valor efectivo. No eval, no código generado, no acceso arbitrario a archivos. No usar una supuesta “confianza 90%” si el motor no entrega una métrica calibrada; combinar resultado final válido, cobertura completa de gramática y ausencia de ambigüedad.

## 7. DSP y ruteo concreto

Entrada x → base de mezcla B: EQ → compresor → de-esser → saturación. Desde B salen ramas independientes 100% efecto: doubler D, chorus C, delay L y reverb R. La entrada de reverb es B + envío configurable de L. No reinyectar R en L. Usar filtrado en retornos y controles de nivel por rama.

Inserto: y = outputGain × (B + gainD·D + gainC·C + gainL·L + gainR·R).
Envío: y = outputGain × (gainD·D + gainC·C + gainL·L + gainR·R).

La señal principal B tiene ganancia unitaria antes del outputGain; no añadas mezcla global dry/wet en v1. “Cantidad” en efectos paralelos controla ganancia de retorno, no agrega dry interno. Propuesta inicial: amount 0..100% → ganancia lineal 0..1; las recetas se afinan por escucha. Los motores deben tener calibración documentada para que las cantidades sean útiles.

En envío nunca sale B directamente. La base de mezcla puede colorear la excitación de efectos si el usuario la activa; no debe confundirse con comprimir la pista original. Seleccionar Envío no crea un auxiliar en el DAW. Mensaje breve fijo “Solo efectos”.

Todos los módulos inician desactivados, output 0 dB, modo Inserto. El estado inicial es transparente, salvo latencia reportada si procede. Las recetas activan módulos necesarios. Un EQ tiene macro firmada de tono; compresor/de-esser/saturación tienen macros propias, no un falso wet/dry idéntico para todos.

Desactivar reverb/delay cierra su alimentación con rampa y deja salir cola. Acción separada “Silenciar retorno” amortigua y limpia estado fuera de operaciones inseguras. Bypass interno total: dry compensado en Inserto, silencio en Envío. Probar/documentar bypass del host por separado; no garantizar su comportamiento externo. Al cambiar modo, crossfade corto, conservar ajustes y evitar saltos bruscos.

## 8. Parámetros de partida

Son especificaciones propuestas para prototipo; validar por escucha y medidas. Registrar ID estable, rango físico, default almacenado, unidad, curva, automatización, smoothing y macro mapping. No modificar IDs después del lanzamiento.

| Módulo | Parámetros y valores almacenados iniciales |
|---|---|
| Global | modo Inserto; output -24..+12 dB, 0; todos enabled=false |
| EQ | HP 20..300 Hz, 80; low shelf y high shelf -12..+12 dB, 0; banda media 200..8000 Hz, 2500; gain -12..+12 dB, 0; Q 0.3..6, 1 |
| Compresor | threshold -60..0 dBFS, -18; ratio 1..10, 3; attack 0.5..100 ms, 10; release 20..500 ms, 100; knee 0..12 dB, 6; makeup 0..12 dB, 0 |
| De-esser | frecuencia 3..10 kHz, 6; threshold -60..0 dBFS, -24; máxima reducción 0..12 dB, 4; ataque/release internos documentados |
| Saturación | drive 0..18 dB, 3; trim -18..0 dB, 0; macro con compensación aproximada documentada, nunca llamada normalización perfecta |
| Doubler | amount 0..100%, 20; width 0..100%, 80; detune 0..12 cents, 5; delay base 8..35 ms, 18; variación 0..100%, 25 |
| Chorus | amount 0..100%, 15; rate 0.05..5 Hz, 0.35; depth 0..1, 0.25; centre delay 5..25 ms, 12; feedback 0..0.5, 0 |
| Delay | amount 0..100%, 12; time 20..2000 ms, 120; sync off; divisiones 1/32..1/1 con puntillo/triplete definidos; feedback 0..85%, 20; HP 20..1000 Hz, 180; LP 1000..18000 Hz, 6500; ping-pong off |
| Reverb | amount 0..100%, 12; decay objetivo 0.2..8 s, 1.2; predelay 0..150 ms, 25; damping 1000..16000 Hz, 6000; HP 20..1000 Hz, 180; width 0..100%, 80 |

Reverb: no etiquetar “segundos” sobre roomSize normalizado sin calibración. Implementar algoritmo con decay controlado y validación de caída, o usar etiqueta “Tamaño” normalizada hasta disponer de decay verificado. Chorus JUCE puede ser base; doubler debe tener implementación diferenciada con dos voces, retardos fraccionales, microafinación y variación independiente. No llamar microafinación a un simple retardo estático ni humanización a un LFO idéntico en ambos canales.

Delay con límites de buffer derivados del peor caso de tempo soportado; si tiempo sync excede capacidad, mostrar limitación explícita o reservar suficiente memoria antes de procesar. Sin BPM válido conservar último tempo válido o usar 120 BPM marcado como fallback. Cambios de tiempo mediante transición adecuada entre taps, no clicks ni barridos accidentales.

Compresor y de-esser dependen del nivel de entrada: presets no garantizan una reducción fija en todas las voces. Mostrar reducción real. Saturación con oversampling si las mediciones de aliasing lo justifican; declarar latencia y coste. Sin limitador escondido ni clipping duro disfrazado de protección. Proteger feedback, estados numéricos y valores no finitos sin destruir transitorios sanos.

Recetas mínimas versionadas: chorus suave, chorus ancho, doubler sutil, doubler ancho, slapback, delay corchea, reverb íntima, reverb oscura, ambiente amplio, teléfono y voz cálida. Cada receta contiene parámetros explícitos y descripción fiel. “Teléfono” debe implementar sus filtros requeridos; no exponer receta si faltan. Los adjetivos modifican solo los parámetros definidos de su módulo.

## 9. Audio en tiempo real y sincronización

processBlock no hace STT, JSON, red, disco, logs, locks bloqueantes, allocations ni llamadas WebView. Preasignar buffers. ScopedNoDenormals y manejo de tamaños de bloque cambiantes, bloques vacíos y layouts admitidos. Soportar mono→mono y estéreo→estéreo; mono→estéreo solo si se implementa y valida. En mono adaptar los algoritmos, no indexar canal 1 inexistente.

Parámetros con AudioProcessorValueTreeState o infraestructura equivalente existente. UI y voz pasan por el mismo controlador nativo y notifican al host con gestos apropiados. No dejar gestos abiertos. Aplicar cambios multi-parámetro mediante snapshots/cola acotada en límite de bloque; documentar que el DAW puede grabar automatización de parámetros individuales, no una transacción indivisible.

Smoothing inicial 10–50 ms según parámetro; coeficientes de filtros con transición estable; cambios topológicos/tiempo con estrategia específica. Compensar latencia algorítmica entre rutas cuando proceda, conservando delays creativos. Reportar setLatencySamples y tail según implementación real. Exportar offline usa solo estado guardado y DSP; nunca espera reconocimiento. RNG de modulación con semilla y política reproducible documentada.

UI usa snapshots revisionados y deltas a 20–30 Hz para medidores, no mensajes por muestra. Al abrir recibe estado completo. JS no es autoridad ni localStorage almacén del preset de sesión. Resolver carreras con revision/commandId; automatización posterior del host debe prevalecer sobre un snapshot antiguo.

Guardar/restaurar parámetros, modo, versión de esquema, receta y estado musical necesario mediante getStateInformation/setStateInformation. Preferencias visuales separadas. A/B captura el estado de sonido. Undo/redo registra cambios del usuario, no añade una entrada por cada tick de automatización. Presets de usuario con escritura atómica fuera del audio thread.

## 10. Correcciones a la skill adjunta y licencias

No copiar contradicciones de los snippets:
1. La regla offline-first prevalece sobre el fetch silencioso del ejemplo: no consultas automáticas de activación en cada apertura.
2. Un prefijo FULL/TRIAL no valida una licencia; JS y localStorage no autorizan el DSP.
3. No exponer `setLicenseStatus(true)` como puerta de confianza. Si el producto usa licencias, C++ valida respuestas/credenciales firmadas mediante el sistema existente y guarda el comprobante verificado. Si falta contrato real, documentar integración pendiente.
4. `buffer.clear()` silencia; `return` con entrada intacta deja dry. No describirlos como equivalentes. Cualquier transición de licencia debe tener comportamiento explícito, suave y compatible con modo Envío.
5. Una carpeta de caché por producto no es aislamiento por instancia. COM initialization sin comprobar resultado no garantiza estabilidad.
6. Error 11/13 no identifica por sí solo una causa universal. Registrar contexto y reproducir.

“Gratis” en esta especificación significa sin API de voz ni coste por orden; no decide que el producto comercial sea gratuito. Reutilizar licencia existente si el proyecto ya la tiene. Si no existe, prototipo funcional sin inventar backend y documentar integración comercial pendiente. No desplegar ni modificar el servicio de licencias. No prometer DRM invulnerable; detección de reloj local tiene límites.

## 11. Organización y entregables

Separar responsabilidades, adaptando nombres al repo:
`PluginProcessor`, `PluginEditor`, `ParameterRegistry`, `VocalEngine`, módulos DSP, `CommandParser`, `CommandExecutor`, `RecipeLibrary`, `SpeechService`, `CommandCapture`, `WebBridge`, `PresetManager`, `LicenseAdapter`.

Entregar:
- Código C++ y UI local conectada; mockup independiente marcado como demo si usa bridge falso.
- Documento de arquitectura y ruteo.
- Registro completo de parámetros/macros.
- Catálogo de comandos/alias y recetas compartido con ayuda UI.
- Configuración CMake con versiones fijadas.
- Pruebas de parser/DSP y matriz de compatibilidad con resultados reales.
- Instrucciones de build, instalación, captura de micrófono y envío por host probado.
- Avisos de licencias y modelos; instalador si el entorno permite compilarlo.

Instalador Windows: binario en Common Files/VST3, desinstalador fuera del bundle, assets/modelos versionados, nunca sobrescribir presets ni licencia. No hacer limpieza por nombres genéricos ni borrar otros plugins. Contemplar que una instalación elevada no debe poner assets solo en el AppData del administrador: distribuir recursos de fábrica accesibles y materializar por usuario al primer uso fuera del audio thread.

## 12. Pruebas y definición de terminado

Parser: al menos 100 casos escritos positivos/negativos incluyendo negaciones, alias, comas decimales, unidades, contexto ausente, orden parcial, contradicciones, límites, texto desconocido y deshacer. Resultado esperado de parámetros, no solo “parser devolvió true”.

Voz: corpus consentido de comandos en español, varias voces/acento, silencio y música sin comandos. Medir exactitud de acción completa y activaciones falsas. Meta inicial de beta: ≥95% de acciones correctas en corpus limpio de comandos admitidos y ninguna activación en los casos negativos ensayados; es criterio propuesto, no garantía universal. Medir percentiles p50/p95 desde soltar botón hasta acuse en equipo especificado; no confundirlo con latencia de audio.

DSP: passthrough inicial, envío sin dry, colas tras desactivar, mono/stereo, ausencia de NaN/Inf, feedback estable, EQ/compresión con señales conocidas, reverb con caída medida y doubler/chorus con pruebas mono. 44.1/48/96 kHz y bloques 32/64/128/256/512/1024 cuando host/hardware permitan. Revisar saturación por aliasing y cambios bruscos por clics.

Host: FL Studio y Ableton disponibles, registrar versiones; varias instancias, dos hosts, cerrar/reabrir editor repetidamente, eliminar instancia durante reconocimiento, guardar/abrir sesión, automatizar controles, cambio de sample rate, render offline, runtime/modelo ausente y funcionamiento sin internet. Usar pluginval si está disponible, sin tratarlo como sustituto de pruebas en DAW.

Terminado requiere que una orden cambie parámetros reales, se escuche el DSP correspondiente, el cambio aparezca en UI, se guarde, se restaure y pueda deshacerse; que Envío no duplique dry; y que cerrar la UI no altere audio. Si algo no se pudo probar, listarlo como pendiente. No reportar “profesional”, “perfecto” o “compatible con todos los DAW” como resultado de una compilación exitosa.

## 13. Orden de implementación

1. Inspeccionar repo/skill, fijar alcance y contratos. Registrar correcciones anteriores.
2. Crear UI WebView local y bridge con controles reales de un módulo vertical completo.
3. Implementar motor y modos, parámetros, estado y edición manual.
4. Implementar parser escrito, recetas, ayuda y deshacer.
5. Conectar captura/STT local al mismo parser sin modificar la arquitectura DSP.
6. Completar pruebas, fallos de lifecycle, rendimiento y empaquetado.

No detenerse en un plan si hay entorno para implementar. No esconder funciones incompletas detrás de controles que aparenten funcionar. La estética WebView y la solidez del motor tienen que llegar juntas.

## Referencias técnicas para verificar durante la implementación

- JUCE WebBrowserComponent Options: https://docs.juce.com/master/classjuce_1_1WebBrowserComponent_1_1Options.html
- WebView2 threading: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model
- COM initialization: https://learn.microsoft.com/es-es/windows/win32/api/combaseapi/nf-combaseapi-coinitializeex
- Vosk y modelos: https://alphacephei.com/vosk/ y https://alphacephei.com/vosk/models
- Alternativa STT: https://github.com/ggml-org/whisper.cpp
- JUCE Chorus: https://docs.juce.com/master/classjuce_1_1dsp_1_1Chorus.html

Las referencias `master` pueden cambiar: contrastar siempre con la versión fijada del proyecto. Esta especificación es un encargo de implementación, no evidencia de un plugin ya construido.
