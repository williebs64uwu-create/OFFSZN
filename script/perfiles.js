import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- 1. CONFIGURACIÓN ---
const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. OBTENER NICKNAME DESDE LA URL ---
// Ejemplo: https://offszn1.onrender.com/WillieInspired
const pathParts = window.location.pathname.split("/");
const nickname = pathParts[pathParts.length - 1] || null;

// --- 3. FUNCIÓN PARA CARGAR PERFIL ---
async function cargarPerfil() {
  const perfilDiv = document.getElementById("perfil");

  if (!nickname) {
    perfilDiv.innerHTML = "<p>⚠️ No se indicó ningún usuario en la URL.</p>";
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("nickname", nickname)
    .single();

  if (error || !data) {
    console.error("Error al cargar perfil:", error);
    perfilDiv.innerHTML = `<p>❌ Usuario "${nickname}" no encontrado.</p>`;
    return;
  }

  perfilDiv.innerHTML = `
    <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
    <p><b>Nickname:</b> ${data.nickname}</p>
    <p><b>Rol:</b> ${data.role || "No definido"}</p>
    <p><b>Estado:</b> ${data.Estado || "No definido"}</p>
  `;
}

// --- 4. EJECUTAR AL CARGAR LA PÁGINA ---
document.addEventListener("DOMContentLoaded", cargarPerfil);
