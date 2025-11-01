// Contenedores
const cursosContainer = document.getElementById("cursosContainer");
const presetsContainer = document.getElementById("presetsContainer");

let cursos = [];
let presets = [];

// Fetch al backend
fetch("https://willie.lovestoblog.com/api/getProductos.php")
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
