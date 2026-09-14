# Vocal Preset — especificación v2: modos, efectos y comandos

## Encargo para la IA de desarrollo

Implementa esta actualización sobre el proyecto Vocal Preset existente. Usa la skill juce-plugin-creator y el prompt maestro anterior para infraestructura. Este documento PREVALECE en interacción, estados, catálogo y comandos. Conserva la interfaz WebView mostrada por el usuario: negro texturizado, tarjetas oscuras, acentos blancos, controles compactos. No volver al diseño verde anterior ni rediseñar el producto.

El resultado debe ser procesamiento real y controles conectados. No se ha implementado ni validado DSP mediante este documento: son decisiones de producto y especificaciones propuestas.

## 1. Dos modos, un solo estado musical

Modo Hablar es la vista inicial de cada editor nuevo: título “Tu voz. Tus efectos.”, botón “PRESIONAR PARA HABLAR” y espacio de resultado vacío. Sin caja de texto, chat, sugerencias automáticas ni instrucciones largas. Cambiar de vista no modifica ningún parámetro musical. Al reabrir el editor puede comenzar en Hablar, pero debe conservar íntegra la mezcla guardada.

Modo Efectos muestra tarjetas con nombre, activación, Cantidad y PERSONALIZAR. Mantener la cuadrícula de cuatro columnas del diseño en tamaño normal; añadir categorías y desplazamiento vertical interno cuando haya más efectos. No reducir tarjetas para meter todo en una fila.

Categorías: Favoritos, Espacio, Modulación, Color y Mezcla. Favoritos contiene inicialmente Doubler, Chorus, Delay y Reverb. Los módulos implementados se pueden activar manualmente como alternativa; la experiencia principal continúa siendo por voz. No mostrar efectos pendientes como si funcionaran.

PERSONALIZAR abre un panel dentro del plugin con Volver, nombre, activación, controles propios y una sección Avanzado plegada. No abre otra ventana ni cambia la receta automáticamente. Permitir fijar un control en su tarjeta. No confundir personalización visual con orden DSP.

En Efectos y Personalizar debe existir un botón de micrófono compacto para ajustar sin regresar a Hablar. Todas las vistas usan la misma captura, parser y estado nativo. Conservar selector Inserto/Envío, Deshacer/Rehacer, Guardar y salida.

## 2. Micrófono y silencio: regla obligatoria

Interacción inicial: clic inicia escucha; segundo clic termina. Durante escucha, el botón cambia a “ESCUCHANDO…” y muestra un punto discreto. Sin escucha continua de fondo ni palabra de activación en esta versión.

Estado de referencia:
1. Reposo: texto de resultado vacío; micrófono no captura.
2. Al pulsar: limpiar resultado anterior e iniciar captura identificada por sessionId/instanceId.
3. Sin voz detectada: continuar hasta tiempo límite; después volver a reposo sin mensaje, historial, efecto ni entrada de undo.
4. Tras voz detectada: terminar al pulsar o después de silencio final configurable internamente; propuesta inicial 700 ms, ajustable tras pruebas.
5. Captura máxima propuesta 8 segundos; sin voz sigue siendo no-op silencioso. Con orden truncada o incompleta, rechazar sin cambios.
6. Interpretar solo resultado final. Las hipótesis parciales nunca aparecen en pantalla ni se ejecutan.
7. Orden válida: aplicar una vez y mostrar solo resultado breve, por ejemplo “Reverb oscura”. Limpiar a los 2.5 segundos o al iniciar la siguiente escucha.
8. Audio hablado pero no reconocido: texto discreto “Comando no reconocido”, máximo 2.5 segundos. No aplica efectos ni pregunta nada.
9. Fallo real de dispositivo/modelo: aviso breve y acceso a Ajustes; no disfrazar fallo como silencio.

Silencio significa zona dinámica vacía; no borrar el título ni el botón. No mostrar “No dijiste nada”, “Silencio detectado”, puntos suspensivos, una transcripción inventada o un preset por defecto.

VAD solo estima presencia de habla: no garantiza separar música/canto. Rechazar ruido y transcripciones sin cobertura completa de comandos. Medir falsos positivos con silencio, ruido y música. Activación explícita + VAD + parser estricto son capas complementarias.

Cancelar captura al cerrar editor, perder foco o cambiar de instancia activa. Ignorar resultados antiguos tras cancelación o tras empezar otra sesión. El audio de música sigue procesándose siempre. Capturar entrada pre-DSP o bus Command Input independiente según disponibilidad del host; no abrir un dispositivo exclusivo automáticamente. Explicar configuración de entrada solo en Ayuda/Ajustes. Si la fuente comparte voz musical y orden, no prometer separación ni silenciar la grabación.

## 3. Catálogo completo previsto

Los valores de presets y escalas aquí son decisiones de diseño que deben afinarse al implementar. Cada fila requiere algoritmo real, registro de parámetros, manual y pruebas antes de exponerse.

| Módulo | Categoría | Cantidad significa | PERSONALIZAR | Ejemplos de voz |
|---|---|---|---|---|
| Reverb | Espacio | Nivel de retorno | Duración, predelay, oscuridad, anchura; avanzado: filtros y difusión | Pon reverb suave; reverb más oscura; reverb a dos segundos |
| Delay | Espacio | Nivel de retorno | Tiempo/sync, feedback, tono, ping-pong; avanzado: filtros | Pon delay; delay a corchea; delay con menos repeticiones |
| Doubler | Modulación | Nivel de dobles | Anchura, desafinación, separación temporal, variación | Pon doubler ancho; menos doubler; doubler más natural |
| Chorus | Modulación | Nivel de retorno | Velocidad, profundidad, anchura; avanzado: retardo y feedback | Chorus suave; chorus más lento; chorus con más profundidad |
| Flanger | Modulación | Mezcla procesada local | Velocidad, profundidad, feedback; avanzado: retardo base | Pon flanger suave; flanger más lento |
| Phaser | Modulación | Mezcla procesada local | Velocidad, profundidad, resonancia; avanzado: etapas | Pon phaser; phaser más profundo |
| Tremolo | Modulación | Profundidad de volumen | Velocidad/sync, forma, suavidad | Pon trémolo suave; trémolo a semicorchea |
| Auto Pan | Modulación | Profundidad panorámica | Velocidad/sync, forma, centro | Pon auto pan; paneo automático más lento |
| Saturación | Color | Macro de drive con compensación aproximada | Drive, tono, salida | Saturación suave; voz más cálida |
| Distorsión | Color | Mezcla de distorsión local | Drive, tipo, tono, salida | Distorsión suave; distorsión más fuerte |
| Bitcrusher | Color | Mezcla degradada local | Bits, reducción de muestreo, filtro | Pon bitcrusher; bitcrusher a ocho bits |
| Filtro | Color | Intensidad de macro de receta, no wet/dry genérico | Tipo, corte, resonancia; receta Teléfono con HP y LP propios | Voz de teléfono; filtro más oscuro |
| Pitch creativo | Color | Mezcla de señal desplazada | Semitonos, calidad; formante solo si está implementado | Baja el pitch tres semitonos; pitch una octava arriba |
| EQ | Mezcla | Macro firmada de tono, rotular TONO | Graves, medios, agudos; avanzado: frecuencias y Q | Más brillo; menos graves; agudos dos decibelios arriba |
| Compresor | Mezcla | Macro de compresión documentada | Threshold, ratio, ataque, release; avanzado: knee y makeup | Compresión suave; compresor con ataque más lento |
| De-esser | Mezcla | Máxima reducción y sensibilidad vinculadas | Sensibilidad, frecuencia, reducción máxima | Reduce las eses; menos de-esser |
| Gate | Mezcla | Macro de umbral documentada | Threshold, ataque, hold, release | Puerta suave; gate con release más largo |

No usar una perilla de porcentaje falsa para todos los algoritmos: vincularla a una macro real, mostrar unidades físicas en PERSONALIZAR y documentar sus efectos. EQ usa TONO; módulos desactivados conservan sus ajustes aunque la tarjeta esté atenuada. Gate no es eliminación de ruido por IA. Pitch creativo no es afinación automática.

Orden de entrega: primero Doubler, Chorus, Delay, Reverb y base EQ/Compresor/De-esser/Saturación; después Filter, Distorsión, Tremolo, Auto Pan, Phaser, Flanger y Bitcrusher; finalmente Pitch y Gate. Es una secuencia de implementación, no autorización para fingir completitud al terminar el primer bloque.

## 4. Recetas: no son módulos duplicados

| Nombre hablado | Implementación propuesta |
|---|---|
| Slapback | Delay 100 ms, sync off, feedback 10%, retorno 15% |
| Eco ping-pong | Delay 1/8, ping-pong on, feedback 25%, retorno 15% |
| Reverb íntima | Reverb corta, objetivo decay 0.6 s, predelay 15 ms, retorno 10% |
| Reverb amplia | Reverb objetivo decay 2.8 s, predelay 35 ms, retorno 20% |
| Reverb oscura | Reverb activa, corte de agudos de retorno 4 kHz; conserva otros parámetros si ya estaba activa |
| Dobles anchos | Doubler retorno 20%, anchura 90%, microafinación 6 cents, separación base 18 ms |
| Voz de teléfono | Filtro HP 350 Hz y LP 3.5 kHz, pendientes documentadas, sin cambiar volumen de salida |
| Voz cálida | Saturación suave, drive 3 dB con compensación documentada; no aumentar graves por sorpresa |
| Voz soñadora | Chorus suave + reverb amplia + delay 1/4 discreto; macro completa con valores explícitos versionados |

Valores orientativos, no resultados garantizados para toda voz. Si reverb no dispone de decay calibrado, la UI no puede mostrar segundos falsos. No incluir nombres de artistas ni “mezcla profesional automática” como promesa de estos presets.

## 5. Gramática de comandos y variaciones

Componer frases mediante acciones + módulo + propiedad + valor. No crear una lista de 500 strings inconexos. Mantener alias, gramática y documentación en catálogo compartido; parser y validación final nativos. STT local conserva arquitectura anterior.

Acciones equivalentes admitidas: “pon”, “ponme”, “activa”, “añade”, “agrega”, “dame”. Desactivar: “quita”, “apaga”, “desactiva”. Relativos: “más”, “menos”, “sube”, “baja”, “aumenta”, “reduce”. Admitir muletillas conocidas como “por favor” en posiciones definidas, sin aceptar texto desconocido arbitrario.

Alias: reverb/reverberación; delay/eco; doubler/doblador/dobles; chorus/corus; tremolo/trémolo; auto pan/autopan/paneo automático; saturación/saturador; distorsión/distorsionador; bitcrusher/bit crusher; filtro; pitch/tono de afinación; EQ/ecualizador/ecualización; compresor/compresión; de-esser/de esser/control de eses; gate/puerta de ruido. Validar que el modelo reconoce estos alias; normalizar errores fonéticos solo con evidencia, no fuzzy matching agresivo.

Familias de comandos:
- Activar: “Pon chorus”, “Dame una reverb suave”, “Activa el doubler”.
- Cantidad: “Más reverb”, “Menos chorus”, “Delay al veinte por ciento”.
- Parámetro: “Reverb a dos segundos”, “Chorus a cero coma cinco hercios”, “Delay con feedback al treinta por ciento”.
- Adjetivo: “Reverb más oscura”, “Doubler más ancho”, “Phaser más lento”.
- Desactivar: “Quita el delay”, “Apaga la distorsión”.
- Compuesto: “Pon chorus suave y reverb oscura”.
- Vista: “Modo efectos”, “Modo hablar”, “Personalizar reverb”, “Volver a efectos”.
- Ruteo: “Modo inserto”, “Modo envío”. Nunca crear pistas DAW con estas órdenes.
- Historial: “Deshacer”, “Rehacer”.
- Salida: “Baja la salida dos decibelios”, “Salida a menos tres decibelios”.
- Guardado: “Guarda este preset” crea un archivo nuevo con nombre automático Vocal Preset + fecha/hora; nunca sobrescribe uno existente por voz. Renombrar manualmente en Guardar.

No implementar reconocimiento libre de nombres de preset en v1. “Todo”, “borra todo”, “reinicia todo” quedan fuera de gramática inicial por falta de alcance explícito; no inventar qué quiso decir.

## 6. Semántica exacta y prioridades

“Pon chorus” habilita el último estado almacenado; si nunca se configuró, usa receta inicial. “Chorus suave/medio/fuerte” selecciona una receta absoluta propia del módulo. “Más chorus” aumenta cantidad cinco puntos; “más chorus suave” es ambiguo y se rechaza. Un aumento relativo sobre módulo apagado no lo activa: muestra “Chorus desactivado” brevemente. Las formas “pon”, “dame” y recetas completas sí activan.

Un ajuste de propiedad de módulo apagado modifica su estado almacenado sin activarlo y muestra, por ejemplo, “Reverb: 2 s · desactivada”. Abrir Personalizar nunca activa el efecto. Evitar cambios audibles no solicitados.

Pasos relativos iniciales:
| Propiedad | Cambio por más/menos |
|---|---|
| Cantidad, anchura, profundidad, feedback en % | 5 puntos porcentuales |
| Velocidad Hz, duración, tiempos ms | ×1.2 o ÷1.2 |
| Brillo de reverb/filtro | Corte ×1.2 para brillante y ÷1.2 para oscuro |
| Ganancia EQ/salida | 1 dB |
| Pitch | 1 semitono |

En tiempo sincronizado, no multiplicar valores ms invisibles: “más lento” sin división explícita se rechaza con ejemplo “Delay a negra”. Para chorus “más lento” disminuye frecuencia, no cambia cantidad. Para release “más largo” aumenta tiempo, no reduce umbral. Para doubler “más natural” invoca receta documentada de variación, no un parámetro inventado.

Contexto: el módulo abierto en Personalizar tiene prioridad para parámetros omitidos; si no hay panel, usar último módulo explícito de una orden válida de esa sesión. Si no existe, “más lento” no cambia nada. Una orden multi-módulo limpia contexto implícito. Al cerrar captura puede mantenerse contexto hasta cambiar preset/cerrar editor. Un clic manual en una tarjeta selecciona contexto; un movimiento de automatización no lo cambia.

Comandos globales definidos: “más brillo/menos brillo” controlan shelf de agudos de EQ y lo activan con otros parámetros neutros si nunca estuvo configurado; “menos graves” controla shelf de graves. “Baja el tono” es ambiguo y se rechaza; exigir “baja el pitch” o “filtro más oscuro”.

Negaciones completas “no pongas X” o “no actives X” son no-op: no activar ni desactivar. “No quiero reverb” puede mapear explícitamente a desactivar reverb; documentar esta forma exacta. Otras negaciones desconocidas se rechazan; nunca eliminar la palabra “no” durante normalización.

Una orden compuesta se valida completa antes de aplicar. Si contiene una cláusula desconocida, no aplicar ninguna. Dos cambios contradictorios al mismo parámetro se rechazan. Una orden genera un solo undo; mensajes duplicados del mismo commandId se ignoran. Orden de operaciones diferente no debe alterar resultado de una misma receta.

Clamps para relativos y rechazo de valores absolutos fuera de rango; mostrar valor final efectivo. Validar unidades y parámetros en C++, aunque la UI ya los valide. Deshacer/repetir sin historia son no-op silenciosos.

## 7. Ruteo ampliado: inserto y envío

Conservar arquitectura de ramas wet del prompt anterior para reverb/delay/doubler/chorus. Extensión propuesta: la base B se obtiene de entrada → Gate → EQ → Compresor → De-esser → Saturación. Rack creativo serial T(B): Pitch → Distorsión → Bitcrusher → Filtro → Phaser → Flanger → Tremolo → Auto Pan. Denominar C=T(B). Todos desactivados son identidad.

Ramas húmedas W se alimentan de C: doubler, chorus, delay y reverb, con niveles independientes; envío delay→reverb sin ciclo. En Inserto: salida=C+W. No añadir otra copia dry escondida.

En Envío hay dos casos definidos automáticamente y visibles como descripción de ruteo:
- Solo módulos paralelos activos: salida=W, ninguna copia directa C.
- Uno o más efectos creativos seriales activos: salida=retorno creativo procesado + W. Forzar mezclas locales de efectos seriales a wet en la ruta de auxiliar sin sobrescribir los valores almacenados de Inserto. No agregar un dry separado. No usar cancelación C−B para “extraer” efectos: causa resultados extraños y no representa un wet general.

La ruta serial puede contener componentes coherentes con entrada por naturaleza —filtros, tremolo, etc.—; no prometer ausencia matemática de señal correlacionada. “Sin dry” significa no sumar una vía directa adicional. Si el último efecto serial se apaga, retirar su retorno con transición y conservar colas paralelas. Si todos los efectos creativos están apagados, Envío devuelve silencio aunque base de mezcla esté activa.

La macro Cantidad de efectos seriales debe controlar drive/profundidad donde sea válido; si solo representa mezcla, en Envío mostrar “100% efecto” bloqueado y dar control NIVEL DE RETORNO por separado. El modo Inserto recupera su mezcla original. Documentar esta diferencia en Personalizar.

Auto Pan en mono: no modificar nivel periódicamente fingiendo panorámica. Mostrar “Requiere salida estéreo” y no aplicar la orden en ese layout. Dobler/chorus tienen versiones mono comprobadas; width se deshabilita cuando carece de efecto.

Cambios de ruta se preparan fuera del audio thread y se aplican con transición sin allocations ni locks bloqueantes. Mantener latencia/compensación coherentes, especialmente al incorporar Pitch. No cortar colas por navegar de vista.

## 8. Catálogo como fuente única

Definir por módulo: id, nombre, aliases, categoría, implemented, enabledParameter, macro, rango/default/unidad, propiedades editables, recetas, adjetivos, comportamiento en inserto/envío/mono, smoothing y plantilla de resultado.

El mismo catálogo genera tarjetas, Personalizar, lista de ayuda y operaciones admitidas. Exponer solo implemented=true. Toda receta identifica versión y lista exacta de cambios. No duplicar reglas divergentes en JS y C++. Persistir parámetros musicales en estado del host; preferencias visuales aparte.

## 9. Casos mínimos de aceptación

1. Abrir editor: Hablar, resultado vacío, sonido de sesión intacto.
2. Pulsar y quedarse callado: resultado vacío, parámetros iguales, sin undo.
3. Ruido/silencio que STT transcribe erróneamente: verificar filtros y reportar fallos, no asumir imposible.
4. “Pon reverb”: activación real y una sola confirmación breve.
5. Repetir callback final: no duplicar cambios.
6. “No pongas chorus”: no activar ni cambiar parámetros.
7. “Chorus suave y algo desconocido”: no aplicar ninguna parte.
8. Más lento sin contexto: no modificar audio.
9. Personalizar chorus → más lento: solo rate cambia.
10. Silencio después de éxito: al iniciar captura se limpia el resultado anterior y no vuelve a aparecer.
11. Cambio manual seguido de voz: operaciones parten del valor actual, no de snapshot antiguo.
12. Cancelar/cerrar durante STT: ignorar resultado sin crash ni aplicar después.
13. Envío con solo reverb y reverb apagada: cola correcta y luego silencio.
14. Envío con distorsión: retorno procesado sin vía directa adicional; mezclas de Inserto restaurables.
15. Auto Pan en mono: no activación falsa ni cambio de volumen.
16. Guardar por voz dos veces: dos nombres distintos, sin sobrescritura.
17. Render offline sin UI/modelo/red: mismo estado musical y procesamiento funcional.
18. Cambiar entre Hablar/Efectos/Personalizar: cero cambios DSP ni cortes.

Entregar código real, catálogo, manual de comandos generado, recetas explícitas y resultados de pruebas. Mantener las pruebas DSP/host del prompt maestro. No declarar listo para venta basándose solo en que la pantalla funciona.
