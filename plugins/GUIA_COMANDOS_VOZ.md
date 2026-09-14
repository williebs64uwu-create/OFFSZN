# OFFSZN Vocal Preset — Guía Oficial de Comandos de Voz (FL Studio / DAW)

Esta guía contiene la referencia completa de todos los comandos de voz, recetas de autor, ajustes relativos y reglas de control que puedes decir a través del micrófono o probar directamente dentro de tu DAW (**FL Studio**, Ableton, Reaper, etc.).

---

## 1. Funcionamiento del Micrófono en FL Studio

El plugin opera con un sistema **Click-to-Talk (Presionar para hablar / Presionar para detener)** con **Silencio Obligatorio (Regla #1)** y **Doble Capa de Detección Inteligente (Tier 1 Local + Tier 2 NVIDIA AI)**:

1. **Haz clic en el botón del micrófono** para empezar a hablar:
   - En **Modo Hablar**: botón grande `PRESIONAR PARA HABLAR` (cambia a `ESCUCHANDO...`).
   - En **Modo Efectos** o **Personalizar**: botón compacto `[Mic]` situado en la cabecera superior.
2. **Habla tu comando** con voz natural:
   - **Tier 1 (Sanitizador Fonético Local - 0ms latencia):** Corrige al vuelo confusiones fonéticas habituales del reconocimiento de voz español/inglés:
     - *"river"*, *"rever"*, *"reber"*, *"riber"*, *"reverbe"* $\rightarrow$ **Reverb**
     - *"diley"*, *"deley"*, *"dilei"* $\rightarrow$ **Delay**
     - *"corus"*, *"choro"* $\rightarrow$ **Chorus**
     - *"dobler"*, *"dabler"*, *"dobles"* $\rightarrow$ **Doubler**
   - **Tier 2 (NVIDIA AI Intent Resolver - Asíncrono Online):** Si dices frases complejas o naturales (ej. *"ponme una sensación de cueva"* o *"abre la voz con algo de river"*), el plugin consulta de manera asíncrona la API de NVIDIA para extraer la intención musical sin congelar la interfaz ni interferir con el audio de FL Studio.
3. **Segundo clic** (o pausa automática de silencio) procesa la orden:
   - **Comando reconocido:** Se aplica de inmediato a los procesadores de audio y aparece una confirmación breve (ej. *"Reverb oscura"*) durante **2.5 segundos** antes de desaparecer limpiamente.
   - **Comando no reconocido:** Muestra *"Comando no reconocido"* durante **2.5 segundos** sin alterar tus efectos.
   - **Silencio absoluto:** Si presionas y no hablas nada, el plugin vuelve a reposo **100% limpio**, sin texto, sin generar comandos falsos y sin ensuciar el historial de Deshacer.

> **Importante para FL Studio:** En Windows, el WebView2 utiliza el micrófono predeterminado de Windows configurado en el sistema (*Configuración de Windows > Sonido > Entrada*). Asegúrate de que tu micrófono vocal esté asignado como dispositivo de grabación predeterminado o que FL Studio no lo tenga bloqueado en modo exclusivo ASIO.

---

## 2. Recetas de Autor (Presets Rápidos de Voz)

Di cualquiera de estas frases exactas para configurar instantáneamente múltiples parámetros:

| Comando Hablado | Procesadores y Ajustes Aplicados |
| :--- | :--- |
| **"Reverb oscura"** | Reverb activa (18%), Decay 1.8s, Oscuridad (Damp) 80%, Anchura 85% |
| **"Reverb íntima"** | Reverb activa (10%), Decay corto 0.6s, Pre-retardo 15ms, presencia vocal centrada |
| **"Reverb amplia"** | Reverb activa (20%), Decay largo 2.8s, Pre-retardo 35ms, gran espacialidad |
| **"Slapback"** | Delay activo (15%), Tiempo ultra rápido 100ms, Feedback 10% (estilo vintage / slap) |
| **"Eco ping-pong"** | Delay activo (15%), Tiempo 250ms (corchea), Modo Ping-Pong estéreo activo |
| **"Delay corchea"** | Delay activo (16%), Tiempo rítmico 250ms, Feedback 25% |
| **"Dobles anchos"** | Doubler activo (20%), Anchura estéreo 90%, Microafinación 6 cents, Retardo 18ms |
| **"Doubler ancho"** | Doubler activo (22%), Anchura 95%, Desafinación 8 cents |
| **"Doubler sutil"** | Doubler activo (12%), Anchura 70%, Desafinación 4 cents para engrosar la voz |
| **"Chorus suave"** | Chorus activo (15%), Velocidad LFO 0.35 Hz, Profundidad 25% sedosa |
| **"Chorus ancho"** | Chorus activo (28%), Velocidad 0.8 Hz, Profundidad 65%, Apertura estéreo máxima |

---

## 3. Comandos Compuestos (Multi-Módulo)

Puedes encadenar dos acciones usando el conector **"y"**. Ambas cláusulas se validan antes de aplicarse en una sola operación musical:

- **"Pon chorus suave y reverb oscura"**
- **"Activa doubler ancho y delay corchea"**
- **"Pon reverb íntima y quita el delay"**

*(Nota de seguridad: si una de las dos órdenes no es válida o contiene palabras desconocidas, el plugin rechaza la frase completa y no aplica cambios a medias).*

---

## 4. Control Directo de Procesadores (Encender / Apagar)

Puedes encender o apagar cualquier efecto por su nombre o alias admitido:

### Activar / Encender:
- **"Pon reverb"** / **"Activa la reverb"** / **"Dame reverb"**
- **"Pon chorus"** / **"Activa el chorus"** / **"Ponme corus"**
- **"Pon delay"** / **"Activa el eco"** / **"Agrega delay"**
- **"Pon doubler"** / **"Activa el doblador"** / **"Pon dobles"**

### Desactivar / Apagar:
- **"Quita la reverb"** / **"Apaga la reverb"** / **"Desactiva reverb"**
- **"Quita el delay"** / **"Apaga el delay"** / **"Quita el eco"**
- **"Quita el chorus"** / **"Desactiva chorus"**
- **"Quita el doubler"** / **"Apaga los dobles"**
- **"No quiero reverb"** / **"No quiero delay"**

---

## 5. Ajustes Relativos de Cantidad (+ / -)

Si un procesador ya está activo, puedes subir o bajar su mezcla en pasos precisos del **5%**:

- **"Más reverb"** / **"Sube la reverb"** / **"Aumenta la reverb"** *(+5%)*
- **"Menos reverb"** / **"Baja la reverb"** / **"Reduce la reverb"** *(-5%)*
- **"Más chorus"** / **"Menos chorus"** *(+5% / -5%)*
- **"Más delay"** / **"Menos delay"** *(+5% / -5%)*
- **"Más doubler"** / **"Menos doubler"** *(+5% / -5%)*

*(Si el efecto está apagado, "más [efecto]" no lo activa por sorpresa: respeta tu mezcla y te informa que el módulo está desactivado).*

---

## 6. Navegación, Enrutamiento e Historial por Voz

También puedes controlar el entorno del plugin sin tocar el ratón:

### Cambio de Vistas:
- **"Modo Efectos"** *(Muestra la cuadrícula de 4 columnas de racks con relieve)*
- **"Modo Hablar"** *(Regresa a la pantalla minimalista de comando vocal)*

### Enrutamiento de Mezcla:
- **"Modo Inserto"** *(Salida directa canal inserto: señal limpia + efectos húmedos)*
- **"Modo Envío"** *(Salida auxiliar 100% wet para buses de envío de efectos)*

### Historial y Guardado:
- **"Deshacer"** *(Revierte el último cambio de voz o perilla)*
- **"Rehacer"** *(Restaura la acción revertida)*
- **"Guardar"** *(Guarda el preset actual en la memoria del plugin)*

---

## 7. Catálogo Completo por Categorías en Modo Efectos

En **Modo Efectos** dispones de 5 pestañas de categoría en la barra superior:
1. **Favoritos:** Doubler, Chorus, Delay y Reverb (100% interactivos con perillas y switches).
2. **Espacio:** Reverb y Delay.
3. **Modulación:** Doubler, Chorus, Flanger, Phaser, Trémolo, Auto Pan.
4. **Color:** Saturación, Distorsión, Bitcrusher, Filtro, Pitch Creativo.
5. **Mezcla:** Tono (EQ), Compresor, De-Esser, Gate.

Al hacer clic en **"Personalizar"** en cualquier tarjeta, se despliega el panel interno con:
- Botón **"Volver"** para regresar a la vista de racks.
- Switch de encendido del módulo.
- Botón **[Mic]** para seguir hablando comandos de voz en ese contexto.
- Sliders analógicos primarios con unidades físicas reales (ms, %, Hz, s, ct).
- Acordeón **"Avanzado"** desplegable para calibrar filtros, tonos y modulación secundaria.
