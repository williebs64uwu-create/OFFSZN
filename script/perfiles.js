import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 👉 reemplaza con tus datos de Supabase
const supabaseUrl = "https://TU_PROYECTO.supabase.co";
const supabaseKey = "TU_CLAVE_ANON";
const supabase = createClient(supabaseUrl, supabaseKey);

// obtiene el nombre de usuario desde la URL, por ejemplo: /WillieInspired
const path = window.location.pathname;
const nickname = path.split("/").filter(Boolean)[0]; // toma la primera parte

async function cargarPerfil() {
  const contenedor = document.getElementById("perfil");

  if (!nickname) {
    contenedor.innerHTML = "<p>Usuario no especificado.</p>";
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("nickname", nickname)
    .single();

  if (error || !data) {
    contenedor.innerHTML = `<p>Usuario no encontrado</p>`;
    console.error(error);
    return;
  }

  contenedor.innerHTML = `
    <div class="perfil-card">
      <h1>${data.first_name || ""} ${data.last_name || ""}</h1>
      <p><b>Nickname:</b> ${data.nickname}</p>
      <p><b>Rol:</b> ${data.role || "No definido"}</p>
      <p><b>Estado:</b> ${data.Estado || "No definido"}</p>
    </div>
  `;
}

cargarPerfil();
