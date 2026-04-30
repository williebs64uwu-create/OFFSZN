OFFSZN FLOW (Versión 1.0 - MVP)
1. Visión del Producto
Transformar el flujo de trabajo del productor de "solo crear" a "crear y promocionar" de manera automática. OFFSZN FLOW actúa como un consultor de marketing que analiza archivos de audio para generar contenido visual y estrategias de redes sociales.

2. Objetivos del MVP (Web-First)
Validación de Formatos: Probar la aceptación de los estilos "BEAT" y "LOOP".

Retención: Implementar el sistema de créditos (100 mensuales) y skips diarios.

Conversión: Facilitar la descarga de un "Media Kit" (Video + Copy + Hashtags) listo para subir.

3. Especificaciones Funcionales
A. Creador de Contenido (Módulo Principal)
Carga de Archivos: Soporte inicial para arrastrar archivos MP3.

Análisis de Audio: Detección automática de BPM, Key (Tonalidad) y Género Sugerido.

Generador de Visualizers:

Generación de 3 vistas previas (Low Res) con waveforms reactivas.

Opciones de estilo: BEAT (enfoque en energía) y LOOP (enfoque en atmósfera/textura).

Generador de Scripts (IA): Creación de 3 variaciones de "Fresh Scripts" para TikTok/Reels basados en el análisis.

B. Sistema de Créditos y Seguridad
Modelo de Uso: Suscripción de 100 créditos mensuales.

Lógica de "Skips": Un sistema de créditos menores para descartar previews de video antes del renderizado final en HD.

Protección: Bloqueo estricto de IP y VPN para evitar el abuso del "sonido gratis de bienvenida".

Autenticación: Inicio de sesión mediante Google o Discord vinculado a la base de datos de OFFSZN.

4. Stack Tecnológico (Infraestructura)
Frontend: Aplicación Web (React/Next.js) con estética Black & White (bordes suaves, UX fluida).

Base de Datos: Supabase (usando la instancia actual de OFFSZN con nuevas tablas para créditos e historial).

Almacenamiento (Assets): Cloudflare R2 (Cuenta/Bucket nuevo para presets, archivos temporales y renders).

5. Flujo del Usuario (User Journey)
Ingreso: El usuario se loguea en la web de OFFSZN FLOW.

Carga: Sube su Beat o Loop terminado.

Configuración: La IA sugiere el género y el usuario elige el formato de video.

Selección (Skip/Check): El usuario previsualiza los visualizers. Si no le gusta, usa un "Skip". Si le gusta, da "Check".

Output: El sistema genera un reporte rápido (PDF opcional) y el Media Kit para descarga.

6. Roadmap (Fases)
Fase 1 (Actual): Desarrollo de la plataforma Web, integración de Supabase/R2 y generador de videos básico.

Fase 2: Lanzamiento de la Beta cerrada para 100 usuarios de la comunidad OFFSZN.

Fase 3: Desarrollo del plugin JUCE para conectar el DAW directamente con este flujo web (Sincronización en tiempo real).