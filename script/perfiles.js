import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Configuración real de Supabase ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Obtener nickname desde query string ---
const params = new URLSearchParams(window.location.search);
const nickname = params.get("nickname"); // ejemplo: ?nickname=WillieInspired

// --- Función para cargar perfil ---
async function cargarPerfil() {
  const contenedor = document.getElementById("perfil");

  if (!nickname) {
    contenedor.innerHTML = "<p>⚠️ No se indicó ningún usuario.</p>";
    return;
  }

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

  // --- Aquí verificamos la plantilla ---
  const template = data.template || "original";

  let html = "";

  if (template === "original") {
    html = `
      <div class="perfil-card original">
        <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
        <p><b>Nickname:</b> ${data.nickname}</p>
        <p><b>Rol:</b> ${data.role || "No definido"}</p>
        <p><b>Estado:</b> ${data.estado || "No definido"}</p>
      </div>
    `;
  } else if (template === "template1") {
    html = `
      <div class="perfil-card template1">
        <h2>${data.nickname}</h2>
        <p><b>Nombre:</b> ${data.first_name || ""} ${data.last_name || ""}</p>
        <p><b>Rol:</b> ${data.role || "No definido"}</p>
        <p><b>Estado:</b> ${data.estado || "No definido"}</p>
        <div class="redes">
          <p><b>Redes:</b> ${JSON.stringify(data.socials)}</p>
        </div>
      </div>
    `;
  } else if (template === "template2") {
    html = `
      <div class="perfil-card template2">
        <h1>${data.nickname}</h1>
        <p><b>Descripción:</b> Este es un perfil público tipo template2</p>
        <p><b>Rol:</b> ${data.role || "No definido"}</p>
        <p><b>Estado:</b> ${data.estado || "No definido"}</p>
      </div>
    `;
  } else {
    // fallback
    html = `
      <div class="perfil-card original">
        <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
        <p><b>Nickname:</b> ${data.nickname}</p>
      </div>
    `;
  }

  contenedor.innerHTML = html;
}

// --- Ejecutar al cargar la página ---
document.addEventListener("DOMContentLoaded", cargarPerfil);
