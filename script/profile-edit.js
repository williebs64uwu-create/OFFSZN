import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

const buttons = document.querySelectorAll("#plantillas button");
const mensaje = document.getElementById("mensaje");

// Aquí se debe poner el ID del usuario logueado desde tu sistema
const userId = "ID_DEL_USUARIO_LOGUEADO";

buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
        const template = btn.dataset.template;

        const { data, error } = await supabase
            .from("users")
            .update({ template })
            .eq("id", userId)
            .select();

        if (error) {
            mensaje.textContent = "❌ Error al actualizar la plantilla";
            console.error(error);
            return;
        }

        mensaje.textContent = `✅ Plantilla cambiada a "${template}"`;
    });
});
