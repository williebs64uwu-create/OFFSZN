EASY SESSION — TECH SPEC V1 (COLLAB AUDIO PLUGINS)
0. OBJETIVO DEL SISTEMA

Crear un sistema de colaboración en tiempo real para plugins VST (EasyMix, EasyMaster) que permita:

Sincronización de parámetros en tiempo real
Colaboración entre usuarios en una “Session”
Visualización de estado de plugins activos
Control de permisos por sesión
Streaming de audio master
1. ARQUITECTURA GENERAL
[ VST Plugins (EasyMix / EasyMaster) ]
                ↓
      [ Local Session Bridge ]
                ↓
        WebSocket Connection
                ↓
          [ Backend Server ]
                ↓
        Real-time Sync Layer
                ↓
        [ Other Clients / UI ]
2. IDENTIDADES PRINCIPALES
2.1 Plugin Instance

Cada plugin cargado = instancia única.

{
  "pluginInstanceId": "UUID",
  "type": "EasyMix | EasyMaster",
  "projectFingerprint": "local-daw-instance-id",
  "status": "idle | connected"
}
2.2 Session

Una sesión representa un proyecto colaborativo activo.

{
  "sessionId": "S_XXXX",
  "ownerUserId": "U_123",
  "state": "active",
  "createdAt": "timestamp"
}
2.3 Plugin Registration (clave del sistema)
{
  "type": "HELLO",
  "pluginInstanceId": "A1",
  "projectFingerprint": "FP_001",
  "pluginType": "EasyMix"
}
3. 🔥 PROBLEMA CLAVE (TU DUDA REAL)
❓ “¿cómo detecta todos los plugins activos?”
❌ NO se hace:
No escanear FL Studio
No leer inserts del DAW
No inspeccionar cadena de efectos global
✅ SOLUCIÓN REAL: SELF REGISTRATION + SCOPE LOCAL

Cada plugin hace:

3.1 Cuando se abre
HELLO → backend
3.2 Se asigna a un “DAW Scope local”
{
  "projectFingerprint": "FP_LOCAL_1"
}

Esto representa:

una instancia abierta de FL Studio (o DAW)

3.3 Backend agrupa por scope
FP_LOCAL_1:
  - EasyMix A1
  - EasyMix A2
  - EasyMaster B1
4. 🔄 CASO: DOS PROYECTOS ABIERTOS (TU DUDA IMPORTANTE)
Escenario:
FL Studio #1 → Proyecto A
FL Studio #2 → Proyecto B
Solución:

Cada instancia genera fingerprint diferente:

Proyecto A:
  projectFingerprint = FP_A

Proyecto B:
  projectFingerprint = FP_B
Resultado:
FP_A → Session S1
FP_B → Session S2

✔ No mezcla datos
✔ No cruza plugins
✔ No colisión de eventos

5. 🧠 “ACTIVE PLUGINS DETECTION” (IMPORTANTE)
Problema:

¿cómo saber qué plugins están activos en un proyecto?

SOLUCIÓN REAL:

No se “detectan”.

Se consideran activos si cumplen:

1. Enviaron HELLO
2. Tienen sessionId asignado
3. Mantienen heartbeat activo
HEARTBEAT:

Cada 5–10 segundos:

{
  "type": "HEARTBEAT",
  "pluginInstanceId": "A1",
  "sessionId": "S1"
}
Si no hay heartbeat:
→ plugin se considera desconectado
6. 🔗 CONEXIÓN A SESIÓN
Paso 1

Usuario crea sesión:

{ "sessionId": "S1" }
Paso 2

Plugins hacen:

REGISTER_SESSION
Paso 3

Backend asigna:

{
  "pluginInstanceId": "A1",
  "sessionId": "S1"
}
7. 🎛️ ORDEN DE PLUGINS (CLAVE IMPORTANTE)
❌ NO depende del DAW

FL Studio no es fuente de orden confiable.

✅ ORDEN VIRTUAL (Easy Layer)
{
  "pluginInstanceId": "A1",
  "uiOrder": 1
}
Reordenamiento:

Hecho solo en Easy Session UI:

drag & drop → update uiOrder
8. 🔁 DUPLICACIÓN DE PLUGINS
Regla:

Duplicar plugin = nueva instancia total

A1 = EasyMix
A2 = EasyMix (copy)
Nunca:
A1 == A2 ❌
9. 🎚️ EVENTOS EN TIEMPO REAL
Cambio de parámetro:
{
  "event": "param_change",
  "pluginInstanceId": "A1",
  "sessionId": "S1",
  "param": "air",
  "value": 72
}
Mutear plugin:
{
  "event": "mute",
  "pluginInstanceId": "A1"
}
10. 🎧 AUDIO STREAM (V1 SIMPLE)
NO stems en V1

Solo:

MASTER OUTPUT STREAM
flujo:
EasyMaster → Audio Engine → WebRTC/Stream → Clients
11. 🚨 CASO: “DOS PROYECTOS + MISMO USUARIO”
PROBLEMA QUE TE PREOCUPA

“puede mezclar sesiones”

SOLUCIÓN FINAL:

El sistema depende de 3 scopes:

userId
projectFingerprint
sessionId
REGLA:
plugin SOLO puede pertenecer a:

1 sessionId
1 projectFingerprint
Resultado:
NO cruza proyectos
NO cruza sesiones
NO cruza DAWs
12. 🧩 “SELECT PLUGINS TO SHARE” (TU IDEA BUENA)

Esto sí es válido como feature opcional:

UI:
Select plugins to sync:
[✔] EasyMix A1
[✔] EasyMix A2
[ ] EasyMaster B1
backend:

Solo registra seleccionados:

{
  "sessionId": "S1",
  "enabledPlugins": ["A1", "A2"]
}
13. 🧱 RESUMEN ARQUITECTURAL
PLUGIN
  → HELLO
  → HEARTBEAT
  → EVENTS
        ↓
LOCAL SCOPE (projectFingerprint)
        ↓
SESSION (sessionId)
        ↓
BACKEND
        ↓
REALTIME SYNC
14. 💡 IDEA CLAVE FINAL

Este sistema NO intenta:

leer FL Studio
reconstruir el DAW
detectar inserts reales
SÍ hace:
los plugins crean su propio universo sincronizado



LA RUTA ES: C:\Users\Willie\Desktop\EASY SESSION