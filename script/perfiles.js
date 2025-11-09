import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Configuración real de Supabase ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "TU_SUPABASE_KEY_AQUI";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Obtener nickname desde query string ---
const params = new URLSearchParams(window.location.search);
const nickname = params.get("nickname"); // ejemplo: ?nickname=WillieInspired

// --- Funciones para renderizar productos y redes ---
function renderProductos(productos = []) {
  if (!productos.length) return "<p>No hay productos aún.</p>";
  return productos.map(p => `<div class="producto-card">${p.nombre}</div>`).join("");
}

function renderRedes(redes = []) {
  if (!redes.length) return "<p>No hay redes registradas.</p>";
  return redes.map(r => `<a href="${r.link}" target="_blank">${r.nombre}</a>`).join(" | ");
}

// --- Plantillas de perfil ---
const templates = {
  original: (data) => `
    <div class="perfil-card original">
      <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
      <p><b>Nickname:</b> ${data.nickname}</p>
      <p><b>Rol:</b> ${data.role || "No definido"}</p>
      <p><b>Estado:</b> ${data.estado || "No definido"}</p>
      <p>${data.descripcion || ""}</p>
      <h3>Productos:</h3>
      <div class="productos">${renderProductos(data.productos)}</div>
      <h3>Redes:</h3>
      <div class="redes">${renderRedes(data.redes)}</div>
    </div>
  `,
  template1: (data) => `
    <div class="perfil-card template1">
      <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
      <p>${data.descripcion || ""}</p>
      <div class="productos">${renderProductos(data.productos)}</div>
      <div class="redes">${renderRedes(data.redes)}</div>
    </div>
  `,
  template2: (data) => `
    <div class="perfil-card template2">
      <div class="header">
        <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
        <p>${data.descripcion || ""}</p>
      </div>
      <div class="productos">${renderProductos(data.productos)}</div>
      <div class="redes">${renderRedes(data.redes)}</div>
    </div>
  `
};

// --- Función para cargar perfil ---
async function cargarPerfil() {
  const contenedor = document.getElementById("perfil");

  if (!nickname) {
    contenedor.innerHTML = "<p>⚠️ No se indicó ningún usuario.</p>";
    return;
  }

  // --- Obtener datos del usuario ---
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("nickname", nickname)
    .single();

  if (error || !data) {
    contenedor.innerHTML = `<p>❌ Usuario "${nickname}" no encontrado.</p>`;
    console.error(error);
    return;
  }

  // --- Obtener productos ---
  const { data: productos } = await supabase
    .from("productos")
    .select("nombre")
    .eq("owner_nickname", nickname);

  data.productos = productos || [];

  // --- Obtener redes ---
  const { data: redes } = await supabase
    .from("redes")
    .select("nombre,link")
    .eq("owner_nickname", nickname);

  data.redes = redes || [];

  // --- Elegir plantilla ---
  const plantilla = data.template || "original"; // "original" si no tiene definida
  contenedor.innerHTML = templates[plantilla](data);
}

// --- Ejecutar al cargar la página ---
document.addEventListener("DOMContentLoaded", cargarPerfil);
