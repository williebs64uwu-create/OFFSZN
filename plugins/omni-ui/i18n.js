// Idioma de la interfaz (ES / EN). Español por defecto. Es una preferencia del usuario (no del proyecto): se guarda en
// el almacenamiento del WebView (carpeta de datos persistente) y vale para todas las instancias.
//   HTML: data-i18n (texto), data-i18n-title (title), data-i18n-tip (data-tooltip), data-i18n-ph (placeholder),
//         data-i18n-html (HTML propio, solo textos fijos de este archivo).
//   JS:   OMNI_I18N.t('clave', { var: valor })  ·  OMNI_I18N.onChange(fn)
(function () {
  var DICT = {
    es: {
      'mode.beat': 'MODO BEAT', 'mode.master': 'MODO MASTER', 'trial': 'PRUEBA',
      'tip.save': 'Guardar preset', 'tip.prev': 'Preset anterior', 'tip.next': 'Siguiente preset',
      'tip.autoLevel': 'Auto Volumen: dale play a la parte más fuerte y pulsa', 'tip.skin': 'Personalizar skin, colores e idioma',
      'skin.title': 'PERSONALIZAR SKIN', 'skin.chassis': 'CHASIS', 'skin.colors': 'COLORES PRINCIPALES', 'skin.gradients': 'GRADIENTES',
      'skin.language': 'IDIOMA',
      'chassis.dark': 'Oscuro', 'chassis.silver': 'Aluminio', 'chassis.glass': 'Glass',
      'chassis.silver.tip': 'Aluminio cepillado', 'chassis.glass.tip': 'Cristal negro',
      'led.red': 'Rojo neón', 'led.purple': 'Morado ultra', 'led.green': 'Verde neón', 'led.white': 'Blanco puro', 'led.fuchsia': 'Fucsia eléctrico',
      'lic.title': 'LICENCIA', 'lic.status': 'Estado', 'lic.key': 'Clave', 'lic.version': 'Versión', 'lic.hwid': 'ID del equipo',
      'lic.change': 'CAMBIAR / ACTIVAR LICENCIA',
      'ref.remove': 'Quitar referencia', 'ref.active': 'Referencia activa',
      'vis.spectrum': 'Espectro', 'vis.stereo': 'Estéreo', 'vis.waveform': 'Onda',
      'p.loudness': 'VOLUMEN', 'p.loudness.sub': 'Maximizador y techo',
      'p.clarity': 'CLARIDAD', 'p.clarity.sub': 'Aire y presencia',
      'p.punch': 'PEGADA', 'p.punch.sub': 'Transitorios graves',
      'p.space': 'ESPACIO', 'p.space.sub': 'Ancho estéreo',
      'p.warmth': 'CALIDEZ', 'p.warmth.sub': 'Saturación de válvula',
      'p.subweight': 'SUB', 'p.airshine': 'BRILLO', 'p.gluecomp': 'COMP. GLUE', 'p.transients': 'TRANSITORIOS',
      'p.harmonics': 'ARMÓNICOS', 'p.stereowidth': 'ANCHO', 'p.maximizer': 'MAXIMIZADOR', 'p.ceiling': 'TECHO',
      'tt.subweight': 'Refuerza los subgraves para una base más pesada, lista para el club.',
      'tt.airshine': 'Añade brillo y presencia sedosa en los agudos, sin dureza.',
      'tt.gluecomp': 'Compresión de bus que une la mezcla: todos los elementos suenan juntos.',
      'tt.transients': 'Moldea el ataque de la batería y los sintes para máximo impacto.',
      'tt.harmonics': 'Saturación analógica de válvula y cinta para una calidez comercial.',
      'tt.stereowidth': 'Abre los laterales para una imagen estéreo más amplia (los graves quedan en mono).',
      'tt.maximizer': 'Sube la sonoridad general de la pista sin introducir distorsión.',
      'tt.ceiling': 'Fija el pico máximo para evitar saturación en las plataformas de streaming.',
      'm.in': 'LUFS ENTRADA', 'm.out': 'LUFS SALIDA', 'm.trim': 'TRIM', 'm.trim.tip': 'Trim de entrada (doble clic: -12 dB)',
      'save.title': 'Guardar en Mis Presets', 'save.name': 'NOMBRE DEL PRESET', 'save.ph': 'p. ej. Mi preset…',
      'save.hint': 'Guarda la configuración actual de las perillas en Mis Presets.', 'save.btn': 'Guardar', 'cancel': 'Cancelar',
      'close': 'Cerrar',
      'ref.analyzing': 'Analizando referencia', 'ref.parametrizing': 'Parametrizando',
      'ref.step.read': 'Audio', 'ref.step.lufs': 'LUFS', 'ref.step.peak': 'Picos', 'ref.step.spec': 'Espectro', 'ref.step.param': 'Ajustes',
      'ref.waiting': 'Esperando el archivo…', 'ref.choose': 'Elige el archivo…',
      'ref.stage.read': 'Leyendo el audio…', 'ref.stage.lufs': 'Midiendo la sonoridad (LUFS)…',
      'ref.stage.peak': 'Midiendo picos reales y ancho estéreo…', 'ref.stage.spec': 'Analizando el espectro…',
      'ref.stage.param': 'Traduciendo el master a los 13 parámetros de Omni…',
      'ref.loudness': 'SONORIDAD', 'ref.crest': 'CRESTA', 'ref.width': 'ANCHO', 'ref.balance': 'BALANCE',
      'ref.compare': 'Compara con tu mezcla', 'ref.hint': 'Dale play a la parte más fuerte de tu canción (coro o drop) y pulsa Escuchar.',
      'ref.listen': 'Escuchar mi mezcla', 'ref.listenAgain': 'Volver a escuchar',
      'ref.tone': 'DIFERENCIA TONAL', 'ref.loudPart': 'PARTE FUERTE', 'ref.amount': 'INTENSIDAD',
      'ref.suggested': 'Ajustes propuestos', 'ref.apply': 'Aplicar ajustes', 'ref.applyMatch': 'Aplicar match', 'ref.applyEstimate': 'Aplicar estimación',
      'ref.matchDone': 'Listo: el match corrige la diferencia entre tu mezcla y la referencia.',
      'ref.listening': 'Escuchando tu mezcla… {s} / {t} s', 'ref.noReference': 'Primero analiza una referencia.',
      'ref.noAudio': 'No se escuchó audio. Dale play a tu canción (con Omni activo) y vuelve a pulsar Escuchar.',
      'ref.stereo': 'estéreo', 'ref.mono': 'mono', 'ref.bal': 'Sub {sub} · Aire {air} dB',
      'err.unsupported_format': 'Formato no compatible', 'err.unsupported_format.msg': 'Solo se admiten archivos WAV, AIFF, FLAC, MP3 u OGG.',
      'err.too_large': 'Archivo demasiado grande', 'err.too_large.msg': 'El archivo supera los 300 MB. Usa una versión más ligera (por ejemplo MP3 o FLAC).',
      'err.too_short': 'Archivo demasiado corto', 'err.too_short.msg': 'La referencia debe durar al menos 10 segundos para poder analizarla con precisión.',
      'err.silent': 'Archivo en silencio', 'err.silent.msg': 'El archivo no contiene señal de audio. Elige otra canción.',
      'err.unreadable': 'No se pudo leer el archivo', 'err.unreadable.msg': 'El archivo está dañado o usa un códec que no se puede decodificar. Prueba con WAV o MP3.',
      'al.title': 'Auto Volumen', 'al.preview': 'Funciona dentro del DAW: dale play a la parte más fuerte (coro o drop) y pulsa este botón.',
      'al.start': 'Escuchando… objetivo {t} LUFS (pulsa para cancelar)',
      'al.progress': 'Escuchando… salida {m} LUFS → objetivo {t} LUFS (pulsa para cancelar)',
      'al.done': 'Volumen ajustado', 'al.done.msg': 'Salida {m} LUFS en la parte más fuerte (objetivo {t} LUFS).',
      'al.unreachable': 'No se llegó al objetivo',
      'al.tooQuiet': 'El Maximizer ya está al máximo: tu mezcla llega muy baja. Sube el Input Trim y vuelve a intentarlo.',
      'al.tooLoud': 'Tu mezcla ya suena más fuerte que el objetivo. Baja el Input Trim y vuelve a intentarlo.',
      'al.nosignal': 'No se escuchó audio', 'al.nosignal.msg': 'Dale play a la parte más fuerte de la canción (el coro o el drop) y pulsa Auto Volumen.',
      'pm.beat': 'PRESETS BEAT', 'pm.master': 'PRESETS MASTER', 'pm.mine': 'Mis Presets', 'pm.empty': 'No hay presets guardados',
      'pm.delete': 'Eliminar preset',
      'preset.No Preset': 'Sin preset', 'preset.Init': 'Inicial',
      'preset.Default Beat (Start Here)': 'Beat por defecto (empieza aquí)', 'preset.Default Master (Start Here)': 'Master por defecto (empieza aquí)',
      'preset.Modern Peak Limit': 'Límite moderno', 'preset.Balanced & Open': 'Equilibrado y abierto', 'preset.Analog Tape Glue': 'Cinta analógica',
      'preset.Crisp & Punchy': 'Nítido y con pegada', 'preset.Wide Soundstage': 'Escenario amplio',
      'act.title': 'Ingresa tu Serial Key', 'act.sub': 'Activa tu plugin para siempre. Consigue tu licencia en OFFSZN.',
      'act.btn': 'Activar Plugin', 'act.get': 'CONSIGUE TU LICENCIA', 'act.verifying': 'Verificando…',
      'exp.title': 'Activar Licencia', 'exp.sub': 'Ingresa tu serial para activarlo.', 'exp.btn': 'Activar Nueva Licencia',
      'exp.retry': 'Reintentar', 'exp.get': 'Consigue tu licencia →',
      'wel.title': '¡Bienvenido a Omni Plugin!', 'wel.msg': 'El plugin ha sido activado exitosamente.<br>Prepárate para llevar tus masters al siguiente nivel.',
      'wel.btn': 'Comenzar',
      'lock.expired': 'Prueba Expirada', 'lock.expired.msg': 'Tu periodo de prueba de 3 días ha expirado. Adquiere una licencia FULL en offszn.lat para seguir usando Omni Plugin.',
      'lock.revoked': 'Licencia No Válida', 'lock.revoked.msg': 'Esta licencia fue revocada o ya no está autorizada en este equipo. Ingresa una licencia válida.',
      'lock.tampered': 'Verifica tu Licencia', 'lock.tampered.msg': 'No pudimos comprobar tu licencia en este equipo. Conéctate a internet e ingresa tu serial para volver a activarla.',
      'lock.clock': 'Fecha y Hora Incorrectas', 'lock.clock.msg': 'La fecha del sistema es anterior a la última vez que usaste el plugin. Corrige la fecha y hora de Windows para continuar.',
      'lerr.offline': 'No se pudo conectar al servidor. Activa tu conexión a Internet para validar la licencia.',
      'lerr.bad_format': 'Formato de serial no válido. Ejemplo: OMNI-FULL-XXXXXXXX-XXXXXXXX',
      'lerr.bad_signature': 'No se pudo verificar la respuesta del servidor. Revisa tu conexión (VPN/proxy) e inténtalo de nuevo.',
      'lerr.server_error': 'El servidor no está disponible ahora. Inténtalo en unos minutos.',
      'lerr.bad_response': 'Respuesta inesperada del servidor. Inténtalo más tarde.',
      'lerr.expired': 'Esta licencia o prueba ya expiró.', 'lerr.revoked': 'Esta licencia fue suspendida o revocada.',
      'lerr.not_found': 'Licencia inválida. Por favor verifica tu Serial Key.',
      'lerr.device_limit': 'Límite de dispositivos alcanzado. Revoca un dispositivo activo en tu cuenta de OFFSZN para poder activar este.',
      'lerr.trial_used': 'Este equipo ya usó su prueba gratuita.',
      'lerr.wrong_product': 'Esta licencia pertenece a otro plugin de OFFSZN. Usa el serial de Omni Plugin (OMNI-…).',
      'lerr.empty.title': 'Activar Licencia', 'lerr.empty': 'Por favor, ingresa tu Serial Key de OFFSZN.',
      'lerr.conn': 'Error de Conexión', 'lerr.act': 'Error de Activación',
      'lic.none': 'Sin licencia activa', 'lic.trial': 'Prueba · {d}', 'lic.sub': 'Suscripción',
      'days': '{n} días', 'day': '1 día', 'lastDay': 'último día'
    },
    en: {
      'mode.beat': 'BEAT MODE', 'mode.master': 'MASTER MODE', 'trial': 'TRIAL',
      'tip.save': 'Save preset', 'tip.prev': 'Previous preset', 'tip.next': 'Next preset',
      'tip.autoLevel': 'Auto Level: play the loudest part and click', 'tip.skin': 'Customize skin, colors and language',
      'skin.title': 'CUSTOMIZE SKIN', 'skin.chassis': 'CHASSIS', 'skin.colors': 'MAIN COLORS', 'skin.gradients': 'GRADIENTS',
      'skin.language': 'LANGUAGE',
      'chassis.dark': 'Dark', 'chassis.silver': 'Aluminum', 'chassis.glass': 'Glass',
      'chassis.silver.tip': 'Brushed aluminum', 'chassis.glass.tip': 'Black glass',
      'led.red': 'Neon red', 'led.purple': 'Ultra purple', 'led.green': 'Neon green', 'led.white': 'Pure white', 'led.fuchsia': 'Electric fuchsia',
      'lic.title': 'LICENSE', 'lic.status': 'Status', 'lic.key': 'Key', 'lic.version': 'Version', 'lic.hwid': 'Machine ID',
      'lic.change': 'CHANGE / ACTIVATE LICENSE',
      'ref.remove': 'Remove reference', 'ref.active': 'Reference loaded',
      'vis.spectrum': 'Spectrum', 'vis.stereo': 'Stereo', 'vis.waveform': 'Waveform',
      'p.loudness': 'LOUDNESS', 'p.loudness.sub': 'Maximizer & Ceiling',
      'p.clarity': 'CLARITY', 'p.clarity.sub': 'Air & Presence',
      'p.punch': 'PUNCH', 'p.punch.sub': 'Low Transients',
      'p.space': 'SPACE', 'p.space.sub': 'Stereo Width',
      'p.warmth': 'WARMTH', 'p.warmth.sub': 'Tube Saturation',
      'p.subweight': 'SUB WEIGHT', 'p.airshine': 'AIR SHINE', 'p.gluecomp': 'GLUE COMP', 'p.transients': 'TRANSIENTS',
      'p.harmonics': 'HARMONICS', 'p.stereowidth': 'STEREO WIDTH', 'p.maximizer': 'MAXIMIZER', 'p.ceiling': 'CEILING',
      'tt.subweight': 'Enhances deep sub-bass frequencies for a heavier, club-ready foundation.',
      'tt.airshine': 'Adds expensive, silky top-end presence without harshness.',
      'tt.gluecomp': 'Tightens the mix, making all track elements sit perfectly together.',
      'tt.transients': 'Shapes the initial attack of drums and synths for maximum impact.',
      'tt.harmonics': 'Injects rich analog tube and tape saturation for commercial warmth.',
      'tt.stereowidth': 'Expands the side channels for a wider stereo image (the low end stays mono).',
      'tt.maximizer': 'Pushes the overall loudness of your track without introducing distortion.',
      'tt.ceiling': 'Sets the absolute maximum peak limit to prevent clipping on streaming platforms.',
      'm.in': 'INPUT LUFS', 'm.out': 'OUTPUT LUFS', 'm.trim': 'TRIM', 'm.trim.tip': 'Input Trim (double-click: -12 dB)',
      'save.title': 'Save to My Presets', 'save.name': 'PRESET NAME', 'save.ph': 'e.g. My Custom Preset…',
      'save.hint': 'Save current knob configuration to My Presets library.', 'save.btn': 'Save', 'cancel': 'Cancel',
      'close': 'Close',
      'ref.analyzing': 'Analyzing reference', 'ref.parametrizing': 'Parametrizing',
      'ref.step.read': 'Audio', 'ref.step.lufs': 'LUFS', 'ref.step.peak': 'Peaks', 'ref.step.spec': 'Spectrum', 'ref.step.param': 'Settings',
      'ref.waiting': 'Waiting for the file…', 'ref.choose': 'Choose the file…',
      'ref.stage.read': 'Reading the audio…', 'ref.stage.lufs': 'Measuring loudness (LUFS)…',
      'ref.stage.peak': 'Measuring true peaks and stereo width…', 'ref.stage.spec': 'Analyzing the spectrum…',
      'ref.stage.param': 'Translating the master into Omni\'s 13 parameters…',
      'ref.loudness': 'LOUDNESS', 'ref.crest': 'CREST', 'ref.width': 'WIDTH', 'ref.balance': 'BALANCE',
      'ref.compare': 'Compare with your mix', 'ref.hint': 'Play the loudest part of your song (chorus or drop) and click Listen.',
      'ref.listen': 'Listen to my mix', 'ref.listenAgain': 'Listen again',
      'ref.tone': 'TONAL DIFFERENCE', 'ref.loudPart': 'LOUD PART', 'ref.amount': 'AMOUNT',
      'ref.suggested': 'Suggested settings', 'ref.apply': 'Apply settings', 'ref.applyMatch': 'Apply match', 'ref.applyEstimate': 'Apply estimate',
      'ref.matchDone': 'Done: the match corrects the difference between your mix and the reference.',
      'ref.listening': 'Listening to your mix… {s} / {t} s', 'ref.noReference': 'Analyze a reference first.',
      'ref.noAudio': 'No audio was heard. Play your song (with Omni active) and click Listen again.',
      'ref.stereo': 'stereo', 'ref.mono': 'mono', 'ref.bal': 'Sub {sub} · Air {air} dB',
      'err.unsupported_format': 'Unsupported format', 'err.unsupported_format.msg': 'Only WAV, AIFF, FLAC, MP3 or OGG files are supported.',
      'err.too_large': 'File too large', 'err.too_large.msg': 'The file is over 300 MB. Use a lighter version (e.g. MP3 or FLAC).',
      'err.too_short': 'File too short', 'err.too_short.msg': 'The reference must be at least 10 seconds long to be analyzed accurately.',
      'err.silent': 'Silent file', 'err.silent.msg': 'The file contains no audio signal. Choose another song.',
      'err.unreadable': 'The file could not be read', 'err.unreadable.msg': 'The file is damaged or uses a codec that cannot be decoded. Try WAV or MP3.',
      'al.title': 'Auto Level', 'al.preview': 'Works inside the DAW: play the loudest part (chorus or drop) and click this button.',
      'al.start': 'Listening… target {t} LUFS (click to cancel)',
      'al.progress': 'Listening… output {m} LUFS → target {t} LUFS (click to cancel)',
      'al.done': 'Level adjusted', 'al.done.msg': 'Output {m} LUFS on the loudest part (target {t} LUFS).',
      'al.unreachable': 'Target not reached',
      'al.tooQuiet': 'The Maximizer is already at maximum: your mix is coming in too quiet. Raise the Input Trim and try again.',
      'al.tooLoud': 'Your mix is already louder than the target. Lower the Input Trim and try again.',
      'al.nosignal': 'No audio was heard', 'al.nosignal.msg': 'Play the loudest part of the song (the chorus or the drop) and click Auto Level.',
      'pm.beat': 'BEAT PRESETS', 'pm.master': 'MASTER PRESETS', 'pm.mine': 'My Presets', 'pm.empty': 'No saved presets',
      'pm.delete': 'Delete preset',
      'preset.No Preset': 'No Preset', 'preset.Init': 'Init',
      'preset.Default Beat (Start Here)': 'Default Beat (Start Here)', 'preset.Default Master (Start Here)': 'Default Master (Start Here)',
      'act.title': 'Enter your Serial Key', 'act.sub': 'Activate your plugin forever. Get your license at OFFSZN.',
      'act.btn': 'Activate Plugin', 'act.get': 'GET YOUR LICENSE', 'act.verifying': 'Verifying…',
      'exp.title': 'Activate License', 'exp.sub': 'Enter your serial to activate it.', 'exp.btn': 'Activate New License',
      'exp.retry': 'Retry', 'exp.get': 'Get your license →',
      'wel.title': 'Welcome to Omni Plugin!', 'wel.msg': 'The plugin has been activated successfully.<br>Get ready to take your masters to the next level.',
      'wel.btn': 'Get started',
      'lock.expired': 'Trial Expired', 'lock.expired.msg': 'Your 3-day trial has expired. Get a FULL license at offszn.lat to keep using Omni Plugin.',
      'lock.revoked': 'Invalid License', 'lock.revoked.msg': 'This license was revoked or is no longer authorized on this computer. Enter a valid license.',
      'lock.tampered': 'Verify your License', 'lock.tampered.msg': 'We could not verify your license on this computer. Connect to the internet and enter your serial to reactivate it.',
      'lock.clock': 'Wrong Date and Time', 'lock.clock.msg': 'The system date is earlier than the last time you used the plugin. Fix the Windows date and time to continue.',
      'lerr.offline': 'Could not connect to the server. Turn on your internet connection to validate the license.',
      'lerr.bad_format': 'Invalid serial format. Example: OMNI-FULL-XXXXXXXX-XXXXXXXX',
      'lerr.bad_signature': 'The server response could not be verified. Check your connection (VPN/proxy) and try again.',
      'lerr.server_error': 'The server is not available right now. Try again in a few minutes.',
      'lerr.bad_response': 'Unexpected server response. Try again later.',
      'lerr.expired': 'This license or trial has expired.', 'lerr.revoked': 'This license was suspended or revoked.',
      'lerr.not_found': 'Invalid license. Please check your Serial Key.',
      'lerr.device_limit': 'Device limit reached. Revoke an active device in your OFFSZN account to activate this one.',
      'lerr.trial_used': 'This computer has already used its free trial.',
      'lerr.wrong_product': 'This license belongs to another OFFSZN plugin. Use your Omni Plugin serial (OMNI-…).',
      'lerr.empty.title': 'Activate License', 'lerr.empty': 'Please enter your OFFSZN Serial Key.',
      'lerr.conn': 'Connection Error', 'lerr.act': 'Activation Error',
      'lic.none': 'No active license', 'lic.trial': 'Trial · {d}', 'lic.sub': 'Subscription',
      'days': '{n} days', 'day': '1 day', 'lastDay': 'last day'
    }
  };

  var lang = 'es';
  try { var saved = localStorage.getItem('omni.lang'); if (saved === 'en' || saved === 'es') lang = saved; } catch (e) { /* sin almacenamiento */ }
  var listeners = [];

  function has(key) { return Object.prototype.hasOwnProperty.call(DICT[lang], key) || Object.prototype.hasOwnProperty.call(DICT.es, key); }
  function t(key, vars) {
    var s = Object.prototype.hasOwnProperty.call(DICT[lang], key) ? DICT[lang][key]
          : Object.prototype.hasOwnProperty.call(DICT.es, key) ? DICT.es[key] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
    return s;
  }
  // Nombre visible de un preset: los fijos de fábrica se traducen; géneros y presets del usuario quedan tal cual
  function preset(name) { return has('preset.' + name) ? t('preset.' + name) : name; }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-tip]').forEach(function (el) { el.dataset.tooltip = t(el.dataset.i18nTip); });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-lang]').forEach(function (el) { el.classList.toggle('active', el.dataset.lang === lang); });
    document.documentElement.lang = lang;
  }

  function setLang(l) {
    if (l !== 'es' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem('omni.lang', l); } catch (e) { /* sin almacenamiento */ }
    apply();
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* un oyente roto no frena a los demás */ } });
  }

  window.OMNI_I18N = { t: t, preset: preset, apply: apply, setLang: setLang, onChange: function (fn) { listeners.push(fn); },
                       get lang() { return lang; } };
  apply();
})();
