// Catálogo de parámetros, familias y presets de Orb (lo genera Orb: node tools/gen_params.js → server/catalog.json).
// Al cambiar parámetros en Orb, vuelve a copiarlo aquí. Va como .js porque el repo ignora los .json.
export default {
 "params": [
  {
   "key": "o1.wave",
   "label": "Onda",
   "opts": [
    "sine",
    "tri",
    "saw",
    "square",
    "pulse",
    "organ",
    "flute",
    "choir"
   ],
   "def": "saw"
  },
  {
   "key": "o1.oct",
   "label": "Oct",
   "min": -3,
   "max": 3,
   "def": 0,
   "log": false,
   "int": true
  },
  {
   "key": "o1.semi",
   "label": "Semi",
   "min": -12,
   "max": 12,
   "def": 0,
   "log": false,
   "int": true
  },
  {
   "key": "o1.fine",
   "label": "Fino",
   "min": -100,
   "max": 100,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "o1.level",
   "label": "Nivel",
   "min": 0,
   "max": 1,
   "def": 0.8,
   "log": false,
   "int": false
  },
  {
   "key": "o1.pan",
   "label": "Pan",
   "min": -1,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "o1.uni",
   "label": "Voces",
   "min": 1,
   "max": 7,
   "def": 1,
   "log": false,
   "int": true
  },
  {
   "key": "o1.det",
   "label": "Detune",
   "min": 0,
   "max": 1,
   "def": 0.25,
   "log": false,
   "int": false
  },
  {
   "key": "o1.spread",
   "label": "Ancho",
   "min": 0,
   "max": 1,
   "def": 0.5,
   "log": false,
   "int": false
  },
  {
   "key": "o2.wave",
   "label": "Onda",
   "opts": [
    "sine",
    "tri",
    "saw",
    "square",
    "pulse",
    "organ",
    "flute",
    "choir"
   ],
   "def": "tri"
  },
  {
   "key": "o2.oct",
   "label": "Oct",
   "min": -3,
   "max": 3,
   "def": 0,
   "log": false,
   "int": true
  },
  {
   "key": "o2.semi",
   "label": "Semi",
   "min": -12,
   "max": 12,
   "def": 0,
   "log": false,
   "int": true
  },
  {
   "key": "o2.fine",
   "label": "Fino",
   "min": -100,
   "max": 100,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "o2.level",
   "label": "Nivel",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "o2.pan",
   "label": "Pan",
   "min": -1,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "o2.uni",
   "label": "Voces",
   "min": 1,
   "max": 7,
   "def": 1,
   "log": false,
   "int": true
  },
  {
   "key": "o2.det",
   "label": "Detune",
   "min": 0,
   "max": 1,
   "def": 0.25,
   "log": false,
   "int": false
  },
  {
   "key": "o2.spread",
   "label": "Ancho",
   "min": 0,
   "max": 1,
   "def": 0.5,
   "log": false,
   "int": false
  },
  {
   "key": "noise",
   "label": "Ruido",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "smp.id",
   "label": "Muestra",
   "opts": [
    "none",
    "soft_bell",
    "cold_bell",
    "pure_bell",
    "mighty_bell"
   ],
   "def": "none"
  },
  {
   "key": "smp.level",
   "label": "Muestra",
   "min": 0,
   "max": 1.5,
   "def": 0.9,
   "log": false,
   "int": false
  },
  {
   "key": "filt.type",
   "label": "Filtro",
   "opts": [
    "lp",
    "lp24",
    "hp",
    "bp"
   ],
   "def": "lp"
  },
  {
   "key": "filt.cutoff",
   "label": "Corte",
   "min": 20,
   "max": 20000,
   "def": 8000,
   "log": true,
   "int": false
  },
  {
   "key": "filt.res",
   "label": "Reson.",
   "min": 0,
   "max": 1,
   "def": 0.15,
   "log": false,
   "int": false
  },
  {
   "key": "filt.env",
   "label": "Env",
   "min": -1,
   "max": 1,
   "def": 0.3,
   "log": false,
   "int": false
  },
  {
   "key": "filt.key",
   "label": "Tecla",
   "min": 0,
   "max": 1,
   "def": 0.2,
   "log": false,
   "int": false
  },
  {
   "key": "filt.sat",
   "label": "Sat",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "aenv.a",
   "label": "Ataque",
   "min": 0.001,
   "max": 5,
   "def": 0.005,
   "log": true,
   "int": false
  },
  {
   "key": "aenv.d",
   "label": "Decay",
   "min": 0.01,
   "max": 5,
   "def": 0.4,
   "log": true,
   "int": false
  },
  {
   "key": "aenv.s",
   "label": "Sust.",
   "min": 0,
   "max": 1,
   "def": 0.7,
   "log": false,
   "int": false
  },
  {
   "key": "aenv.r",
   "label": "Rel.",
   "min": 0.01,
   "max": 8,
   "def": 0.25,
   "log": true,
   "int": false
  },
  {
   "key": "fenv.a",
   "label": "Ataque",
   "min": 0.001,
   "max": 5,
   "def": 0.005,
   "log": true,
   "int": false
  },
  {
   "key": "fenv.d",
   "label": "Decay",
   "min": 0.01,
   "max": 5,
   "def": 0.4,
   "log": true,
   "int": false
  },
  {
   "key": "fenv.s",
   "label": "Sust.",
   "min": 0,
   "max": 1,
   "def": 0.3,
   "log": false,
   "int": false
  },
  {
   "key": "fenv.r",
   "label": "Rel.",
   "min": 0.01,
   "max": 8,
   "def": 0.25,
   "log": true,
   "int": false
  },
  {
   "key": "fm.amt",
   "label": "FM",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "fm.ratio",
   "label": "Ratio",
   "min": 0.25,
   "max": 8,
   "def": 2,
   "log": true,
   "int": false
  },
  {
   "key": "fm.decay",
   "label": "FM decay",
   "min": 0.02,
   "max": 3,
   "def": 0.4,
   "log": true,
   "int": false
  },
  {
   "key": "penv.amt",
   "label": "Golpe",
   "min": -24,
   "max": 24,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "penv.time",
   "label": "Golpe t.",
   "min": 0.005,
   "max": 0.5,
   "def": 0.04,
   "log": true,
   "int": false
  },
  {
   "key": "lfo.wave",
   "label": "LFO",
   "opts": [
    "sine",
    "tri",
    "saw",
    "square"
   ],
   "def": "sine"
  },
  {
   "key": "lfo.dest",
   "label": "Destino",
   "opts": [
    "pitch",
    "cutoff",
    "amp"
   ],
   "def": "pitch"
  },
  {
   "key": "lfo.rate",
   "label": "Veloc.",
   "min": 0.1,
   "max": 20,
   "def": 4,
   "log": true,
   "int": false
  },
  {
   "key": "lfo.depth",
   "label": "Prof.",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "fx.drive",
   "label": "Drive",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "fx.chorus",
   "label": "Chorus",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "fx.delay",
   "label": "Delay",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "fx.dtime",
   "label": "Tiempo",
   "min": 0.05,
   "max": 1,
   "def": 0.3,
   "log": true,
   "int": false
  },
  {
   "key": "fx.dfb",
   "label": "Feedb.",
   "min": 0,
   "max": 0.9,
   "def": 0.35,
   "log": false,
   "int": false
  },
  {
   "key": "fx.reverb",
   "label": "Reverb",
   "min": 0,
   "max": 1,
   "def": 0.12,
   "log": false,
   "int": false
  },
  {
   "key": "fx.rsize",
   "label": "Tamaño",
   "min": 0,
   "max": 1,
   "def": 0.5,
   "log": false,
   "int": false
  },
  {
   "key": "m.vol",
   "label": "Vol",
   "min": 0,
   "max": 1,
   "def": 0.7,
   "log": false,
   "int": false
  },
  {
   "key": "m.glide",
   "label": "Glide",
   "min": 0,
   "max": 1,
   "def": 0,
   "log": false,
   "int": false
  },
  {
   "key": "m.mono",
   "label": "Mono",
   "opts": [
    true,
    false
   ],
   "def": false
  }
 ],
 "families": [
  {
   "key": "bass",
   "label": "Bass",
   "desc": "Graves con cuerpo: 808 con golpe de tono, slides y sub limpio.",
   "presets": [
    "808 Classic",
    "808 Slide",
    "808 Distorted",
    "808 Latin Long",
    "Reese Dark",
    "Sub Pure"
   ]
  },
  {
   "key": "keys",
   "label": "Keys",
   "desc": "Teclas oscuras y suaves: pianos de fieltro, eléctricos y órgano.",
   "presets": [
    "Felt Piano",
    "Rhodes Haze",
    "Wurli Warm",
    "Glass EP",
    "Dark Keys Lo-Fi",
    "Church Organ"
   ]
  },
  {
   "key": "synths",
   "label": "Synths",
   "desc": "Pads oscuros, coros y stacks anchos para trap y drill.",
   "presets": [
    "Dark Pad",
    "Choir Pad Trap",
    "Super Saw Wide",
    "Arp Pulse",
    "Warm Stack",
    "Ghost Pad"
   ]
  },
  {
   "key": "leads",
   "label": "Leads",
   "desc": "Melodías al frente: silbido latino, flauta suave y leads con glide.",
   "presets": [
    "Latin Whistle",
    "Soft Flute",
    "Sync Lead",
    "Mono Glide",
    "Screamer",
    "Pluck Lead"
   ]
  },
  {
   "key": "plucks",
   "label": "Plucks",
   "desc": "Guitarra de nylon, arpa, kalimba y marimba para melodías latinas.",
   "presets": [
    "Nylon Guitar",
    "Harp Pluck",
    "Kalimba",
    "Marimba Pluck",
    "Pure Bell",
    "Pizzicato"
   ]
  },
  {
   "key": "mallets",
   "label": "Mallets",
   "desc": "Cajas de música, campanas y vibráfonos para melodías de trap.",
   "presets": [
    "Soft Bell",
    "Cold Bell",
    "Vibraphone",
    "Marimba Wood",
    "Mighty Bell",
    "Xylophone"
   ]
  },
  {
   "key": "strings",
   "label": "Strings",
   "desc": "Cuerdas cinemáticas, oscuras para drill y con aire de cinta.",
   "presets": [
    "Cinematic Strings",
    "Dark Strings Drill",
    "Staccato Strings",
    "Cello Legato",
    "Violin Sul",
    "Tape Strings"
   ]
  }
 ]
};
