// Presets de fábrica de Omni. Datos puros (sin DOM): también los lee tools/export_presets.mjs para validarlos en C++
// (tests/OmniTests.cpp renderiza audio con CADA preset y comprueba nivel, techo, cresta y consistencia).
//
// Reglas de diseño de un preset (los 13 valores SIEMPRE completos; 50 = neutro):
//   · Gain staging: el Input Trim nace en -12 dB y el Maximizer suma 0…+24 dB (50 % = +12 dB = devuelve el nivel).
//     Por eso 50/50 es neutro; los presets nunca tocan el trim (lo decide el usuario según lo caliente que venga su mezcla).
//   · Maximizer: 0-50 % = 0…+12 dB, 50-100 % = +12…+36 dB (presets 50-64) · Loudness 50-60 · Ceiling 94-98 (-0.6 … -0.2 dB). Sonoridad de salida orientativa con un beat
//     caliente (-15,5 LUFS de entrada): suave -16…-14 · medio -14…-11 · fuerte -11…-9 LUFS (validado en OmniTests).
//   · El carácter (graves, aire, ancho, glue) es lo que cambia entre géneros; no el volumen.
(function () {
  'use strict';

  var ORDER = ['subweight', 'punch', 'warmth', 'harmonics', 'clarity', 'airshine', 'gluecomp', 'transients', 'stereowidth', 'space', 'maximizer', 'loudness', 'ceiling'];
  function P(a) { var o = {}; for (var i = 0; i < ORDER.length; i++) o[ORDER[i]] = a[i]; return o; }

  var NEUTRAL = P([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]);

  //                                sub pun war har cla air glu tra  sw spa max lou ceil
  var BEAT = {
    'Trap': [
      ['Rage',               P([46, 50, 35, 70, 50, 65, 50, 50, 35, 50, 73, 50, 96])],
      ['Pluggnb',            P([56, 51, 38, 35, 34, 57, 49, 51, 57, 50, 64, 50, 95])],
      ['Plugg',              P([54, 40, 20, 50, 45, 18, 63, 40, 35, 50, 72, 50, 95])],
      ['Drill',              P([51, 49, 74, 50, 69, 90, 52, 49, 48, 50, 74, 50, 95])],
      ['Detroit',            P([60, 38, 80, 50, 34, 55, 66, 38, 35, 50, 64, 50, 95])],
      ['Melodic',            P([56, 46, 78, 35, 43, 32, 56, 46, 54, 50, 68, 50, 95])]
    ],
    'Boom Bap': [
      ['Lo-Fi',              P([52, 46, 55, 50, 42, 10, 56, 46, 35, 50, 70, 50, 94])],
      ['90s',                P([38, 53, 20, 42, 64, 50, 46, 53, 35, 50, 77, 50, 94])],
      ['G Funk',             P([58, 60, 68, 45, 55, 55, 55, 50, 60, 55, 61, 50, 94])],
      ['Drumless',           P([15, 56, 81, 40, 35, 15, 42, 56, 61, 50, 72, 50, 94])],
      ['Old Boom Bap',       P([52, 72, 70, 52, 45, 35, 62, 65, 45, 38, 58, 50, 94])],
      ['R&B',                P([50, 45, 60, 38, 62, 65, 48, 38, 68, 65, 66, 50, 95])]
    ],
    'Pop': [
      ['Indie Pop',          P([45, 55, 55, 40, 62, 62, 52, 52, 62, 58, 66, 50, 95])],
      ['Synth Pop',          P([55, 62, 45, 45, 70, 72, 58, 58, 70, 66, 74, 50, 96])],
      ['Hyperpop',           P([46, 56, 28, 65, 48, 59, 43, 56, 70, 50, 76, 50, 97])],
      ['Latino',             P([60, 66, 50, 45, 66, 62, 58, 62, 62, 55, 71, 50, 96])],
      ['80s Retro',          P([45, 60, 42, 50, 59, 76, 58, 55, 66, 66, 67, 50, 95])]
    ],
    'Rock': [
      ['Indie Rock',         P([48, 62, 58, 45, 55, 52, 55, 58, 58, 55, 68, 50, 95])],
      ['Alt Rock',           P([52, 68, 60, 52, 58, 55, 62, 62, 62, 55, 72, 50, 95])],
      ['Metalcore',          P([55, 75, 55, 62, 62, 55, 70, 66, 68, 52, 73, 50, 96])],
      ['Classic Rock',       P([48, 58, 66, 48, 50, 48, 58, 52, 56, 52, 61, 50, 95])],
      ['Grunge',             P([52, 66, 70, 58, 42, 38, 66, 58, 55, 45, 60, 50, 94])]
    ],
    'Reggaeton': [
      ['Latino',             P([57, 47, 44, 48, 59, 53, 54, 47, 56, 50, 68, 50, 96])],
      ['Old School',         P([60, 61, 85, 50, 65, 30, 36, 61, 70, 50, 60, 50, 95])],
      ['New School',         P([49, 52, 41, 46, 71, 90, 47, 52, 70, 50, 76, 50, 96])],
      ['Dembow',             P([54, 43, 55, 45, 54, 28, 59, 43, 35, 50, 72, 50, 96])],
      ['Mexa',               P([59, 47, 55, 50, 64, 90, 54, 47, 70, 50, 72, 50, 95])],
      ['Dancehall',          P([58, 51, 55, 50, 25, 56, 48, 51, 39, 50, 67, 50, 95])],
      ['Afrobeat',           P([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 69, 50, 95])]
    ]
  };

  var MASTER = [
    ['Modern Peak Limit',    P([58, 62, 52, 50, 60, 62, 62, 62, 60, 52, 64, 56, 98])],
    ['Balanced & Open',      P([52, 55, 48, 40, 62, 66, 48, 52, 66, 62, 54, 52, 96])],
    ['Analog Tape Glue',     P([55, 58, 72, 65, 50, 48, 68, 50, 54, 50, 54, 52, 95])],
    ['Crisp & Punchy',       P([54, 72, 48, 50, 68, 70, 60, 74, 60, 54, 59, 56, 97])],
    ['Wide Soundstage',      P([52, 52, 48, 45, 60, 68, 50, 50, 78, 72, 54, 52, 96])]
  ];

  // Objetivo de sonoridad (LUFS a corto plazo de la parte más fuerte) que usa el botón de Auto Volumen.
  // Presets con canción medida (MEASURED): sonoridad real de su parte fuerte. El resto: estimación por estilo
  // (tools/reference_songs.json) hasta que tengan canción.
  var TARGET_LUFS = {
    'Trap - Rage': -8.0, 'Trap - Pluggnb': -10.3, 'Trap - Plugg': -7.9, 'Trap - Drill': -5.3, 'Trap - Detroit': -9.4, 'Trap - Melodic': -8.2,
    'Boom Bap - Lo-Fi': -7.9, 'Boom Bap - 90s': -7.3, 'Boom Bap - G Funk': -10.5, 'Boom Bap - Drumless': -9.3, 'Boom Bap - Old Boom Bap': -12, 'Boom Bap - R&B': -9.5,
    'Pop - Indie Pop': -10, 'Pop - Synth Pop': -6.5, 'Pop - Hyperpop': -6.9, 'Pop - Latino': -6.5, 'Pop - 80s Retro': -10,
    'Rock - Indie Rock': -9, 'Rock - Alt Rock': -7.5, 'Rock - Metalcore': -5.5, 'Rock - Classic Rock': -11, 'Rock - Grunge': -11,
    'Reggaeton - Latino': -8.5, 'Reggaeton - Old School': -10.4, 'Reggaeton - New School': -6.9, 'Reggaeton - Dembow': -6.5,
    'Reggaeton - Mexa': -4.1, 'Reggaeton - Dancehall': -8.5, 'Reggaeton - Afrobeat': -8.5,
    'Modern Peak Limit': -7, 'Balanced & Open': -10, 'Analog Tape Glue': -9, 'Crisp & Punchy': -8, 'Wide Soundstage': -10
  };
  var DEFAULT_TARGET_LUFS = -9;

  // Presets CALIBRADOS con una canción real (OmniAnalyze → referencias/analisis.json → tools/preset_tuning.json →
  // OmniCalibrate). tone = diferencia de esa canción frente a la media de todas (al 75 %, dB en sub 45-60 Hz, cuerpo
  // 200-300 Hz, presencia 2,5-3,5 kHz y aire 11-14 kHz); OmniCalibrate ajusta las 4 perillas de tono en lazo cerrado hasta
  // producirla. Ancho y dinámica salen de la misma comparación (ancho y cresta frente a la media); Maximizer =
  // el que lleva el beat de prueba a la sonoridad de su parte fuerte SIN bajar de 6 dB de cresta (cappedByCrest: se
  // quedó en ese tope y el Auto Volumen, con el mismo objetivo, completa el volumen). Los demás presets: valores estimados.
  var MEASURED = {
    'Trap - Rage': { song: "Playboi Carti - Sky [Official Video] - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: -0.38, body: -0.93, pres: 0.17, air: 1.26 } },
    'Trap - Pluggnb': { song: "Summrs - put out fye - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 1.19, body: -0.54, pres: -1.46, air: 0.87 } },
    'Trap - Plugg': { song: "Playboi Carti - Magnolia - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 0.67, body: -2.01, pres: 0.02, air: -1.45 } },
    'Trap - Drill': { song: "POP SMOKE - DIOR (OFFICIAL VIDEO) - (320 Kbps).mp3", cappedByCrest: true, tone: { sub: -0.3, body: 1.03, pres: 1.07, air: 2.08 } },
    'Trap - Detroit': { song: "Yn Jay x Louie Ray - _Coochie_ (Official Music Video) Shot By JerrickHD - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 1.46, body: 1.85, pres: -1.98, air: -0.02 } },
    'Trap - Melodic': { song: "Juice WRLD - Lucid Dreams (Official Music Video) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 0.69, body: 1.61, pres: -1.05, air: -1.73 } },
    'Boom Bap - Lo-Fi': { song: "Nujabes - Luv(sic) feat.Shing02 [Official Audio] - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 0.3, body: -0.23, pres: -0.9, air: -4.58 } },
    'Boom Bap - 90s': { song: "2Pac - Do For Love (Official Music Video) ft. Eric Williams - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: -1.5, body: -2.03, pres: 1.96, air: 0.48 } },
    'Boom Bap - Drumless': { song: "The Alchemist - E. Coli (feat. Earl Sweatshirt) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: -5.35, body: 1.5, pres: -1.79, air: -2.41 } },
    'Pop - Hyperpop': { song: "100 gecs - money machine (Official Music Video) - (320 Kbps) (1).mp3", cappedByCrest: false, tone: { sub: -0.23, body: -1.13, pres: 0.12, air: 1.09 } },
    'Reggaeton - Latino': { song: "BAD BUNNY - VOY A LLeVARTE PA PR (Visualizer) _ DeBÍ TiRAR MáS FOToS - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 0.87, body: -0.63, pres: 0.97, air: 0.21 } },
    'Reggaeton - Old School': { song: "Don Omar - Dile (Visualizer) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 0.94, body: 2.0, pres: 1.18, air: -2.09 } },
    'Reggaeton - New School': { song: "Feid - SORRY 4 THAT MUCH (Official Video) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: -0.44, body: -0.93, pres: 1.69, air: 2.42 } },
    'Reggaeton - Dembow': { song: "El Alfa _El Jefe_ - Singapur (El Androide) - (320 Kbps).mp3", cappedByCrest: true, tone: { sub: 0.41, body: 0.29, pres: 0.52, air: -1.57 } },
    'Reggaeton - Mexa': { song: "YEYO - amor, cómo ESTÁS___ - (320 Kbps).mp3", cappedByCrest: true, tone: { sub: 1.0, body: 0.3, pres: 1.03, air: 2.85 } },
    'Reggaeton - Dancehall': { song: "Rels B - A MÍ (Videoclip Oficial) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: 1.55, body: 0.6, pres: -2.48, air: 0.62 } },
    'Pop - 80s Retro': { song: "Michael Jackson - Thriller (Official Video - Shortened Version) - (320 Kbps).mp3", cappedByCrest: false, tone: { sub: -0.86, body: -0.74, pres: 0.91, air: 1.97 }, toneOnly: true }
  };

  // Presets SIN canción todavía: su volumen sí está calibrado con OmniCalibrate (Maximizer hasta su objetivo estimado,
  // con el mismo tope de cresta), así no hay saltos de volumen al cambiar de preset. Su tono sigue siendo una estimación
  // por estilo hasta que tengan canción en referencias/. ('toneOnly' arriba: 80s Retro usa el tono de Thriller, pero
  // ese archivo es mono y del video, así que su volumen y ancho siguen siendo estimados.)
  var LOUDNESS_CALIBRATED = {
    'Boom Bap - G Funk': { cappedByCrest: false },
    'Boom Bap - Old Boom Bap': { cappedByCrest: false },
    'Boom Bap - R&B': { cappedByCrest: false },
    'Pop - Indie Pop': { cappedByCrest: false },
    'Pop - Synth Pop': { cappedByCrest: true },
    'Pop - Latino': { cappedByCrest: true },
    'Rock - Indie Rock': { cappedByCrest: false },
    'Rock - Alt Rock': { cappedByCrest: false },
    'Rock - Metalcore': { cappedByCrest: true },
    'Rock - Classic Rock': { cappedByCrest: false },
    'Rock - Grunge': { cappedByCrest: false },
    'Reggaeton - Afrobeat': { cappedByCrest: false }
  };

  // Estructuras que usa app.js (mismas formas que antes): categorías → nombres, y nombre completo → valores
  var beatPresetData = {}, presetValuesMap = {};
  Object.keys(BEAT).forEach(function (cat) {
    beatPresetData[cat] = BEAT[cat].map(function (e) { return e[0]; });
    BEAT[cat].forEach(function (e) { presetValuesMap[cat + ' - ' + e[0]] = e[1]; });
  });
  var masterPresetData = ['Default Master (Start Here)'].concat(MASTER.map(function (e) { return e[0]; }));
  MASTER.forEach(function (e) { presetValuesMap[e[0]] = e[1]; });
  presetValuesMap['No Preset'] = NEUTRAL;
  presetValuesMap['Default Beat (Start Here)'] = NEUTRAL;
  presetValuesMap['Default Master (Start Here)'] = NEUTRAL;

  var api = { ORDER: ORDER, NEUTRAL: NEUTRAL, beatPresetData: beatPresetData, masterPresetData: masterPresetData, presetValuesMap: presetValuesMap,
              targetLufs: TARGET_LUFS, defaultTargetLufs: DEFAULT_TARGET_LUFS, measured: MEASURED,
              loudnessCalibrated: LOUDNESS_CALIBRATED };
  if (typeof window !== 'undefined') window.OMNI_PRESETS = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
