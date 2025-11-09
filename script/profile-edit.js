import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Configuración ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "TU_KEY_DE_SUPABASE"; // Igual que antes
const supabase = createClient(supabaseUrl, supabaseKey);

// Nickname del usuario logueado (puedes tomarlo desde sesión o query string)
const nickname = "WillieInspired";

// --- Selección de plantillas ---
const botones = document.querySelectorAll('#seleccion-template button');
const mensaje = document.getElementById('mensaje-template');

botones.forEach(btn => {
  btn.addEventListener('click', async () => {
    const templateElegida = btn.dataset.template;

    const { data, error } = await supabase
      .from('users')
      .update({ template: templateElegida })
      .eq('nickname', nickname);

    if (error) {
      mensaje.textContent = "❌ Error al guardar la plantilla.";
      console.error(error);
    } else {
      mensaje.textContent = `✅ Plantilla "${templateElegida}" guardada.`;
      cargarPerfil(); // Actualiza previsualización automáticamente
    }
  });
});

// --- Previsualización ---
const previewCont = document.getElementById('perfil-preview');

async function cargarPerfil() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('nickname', nickname)
    .single();

  if (error || !data) {
    previewCont.innerHTML = `<p>❌ No se pudo cargar el perfil.</p>`;
    console.error(error);
    return;
  }

  // Muestra la plantilla seleccionada
  const template = data.template || 'original';
  previewCont.innerHTML = `
    <div class="perfil-card ${template}">
      <h3>${data.first_name || ""} ${data.last_name || ""}</h3>
      <p><b>Nickname:</b> ${data.nickname}</p>
      <p><b>Rol:</b> ${data.role || "No definido"}</p>
      <p><b>Estado:</b> ${data.estado || "No definido"}</p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', cargarPerfil);
