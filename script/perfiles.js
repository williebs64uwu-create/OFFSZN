import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Supabase config ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "TU_CLAVE_ANON"; // reemplaza con tu clave real
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Obtener nickname de la URL ---
const pathParts = window.location.pathname.split("/").filter(Boolean);
const nickname = pathParts[0]; // Ej: /WillieInspired → "WillieInspired"

// --- Cargar perfil ---
async function cargarPerfil() {
  const contenedor = document.getElementById("perfil");

  if (!nickname) {
    contenedor.innerHTML = "<p>⚠️ Usuario no especificado.</p>";
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

  contenedor.innerHTML = `
    <div class="perfil-card">
      <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
      <p><b>Nickname:</b> ${data.nickname}</p>
      <p><b>Rol:</b> ${data.role || "No definido"}</p>
      <p><b>Estado:</b> ${data.estado || "No definido"}</p>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", cargarPerfil);
