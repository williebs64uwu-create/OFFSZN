// Contenedores
const cursosContainer = document.getElementById("cursosContainer");
const presetsContainer = document.getElementById("presetsContainer");

let cursos = [];
let presets = [];

// Fetch al backend
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://offszn-oc7c.onrender.com/api';

fetch(`${API_URL}/products`)
  .then(res => {
    if (!res.ok) throw new Error("Error HTTP " + res.status);
    return res.json();
  })
  .then(data => {
    cursos = data.filter(p => p.categoria === "curso");
    presets = data.filter(p => p.categoria === "preset");

    renderCursos();
    renderPresets();
  })
  .catch(err => {
    console.error("Error al cargar productos:", err);
    if (cursosContainer) cursosContainer.innerHTML = "<p>Error al cargar cursos 😕</p>";
    if (presetsContainer) presetsContainer.innerHTML = "<p>Error al cargar presets 😕</p>";
  });
