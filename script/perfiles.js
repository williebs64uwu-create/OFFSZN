import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔹 Reemplaza con tus datos reales
const supabaseUrl = "https://TU_PROYECTO.supabase.co";
const supabaseKey = "TU_CLAVE_ANON";
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔹 Leer usuario de la URL: /pagina.html?user=willieinspired
const params = new URLSearchParams(window.location.search);
const nickname = params.get("user");

async function cargarPerfil() {
  if (!nickname) {
    document.getElementById("perfil").innerHTML = "<p>Falta el nombre de usuario.</p>";
    return;
  }

  // 🔹 Consultar tu tabla 'users'
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("nickname", nickname)
    .single();

  if (error) {
    console.error(error);
    document.getElementById("perfil").innerHTML = `<p>Usuario no encontrado</p>`;
    return;
  }

  console.log("Datos del usuario:", data);

  // 🔹 Muestra los datos que quieras
  document.getElementById("perfil").innerHTML = `
    <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
    <p><b>Nickname:</b> ${data.nickname}</p>
    <p><b>Email:</b> ${data.email || "No disponible"}</p>
    <p><b>Rol:</b> ${data.role || "No especificado"}</p>
    <p><b>Productor:</b> ${data.is_producer ? "Sí" : "No"}</p>
    <p><b>Estado:</b> ${data.Estado || "No definido"}</p>
  `;
}

cargarPerfil();
