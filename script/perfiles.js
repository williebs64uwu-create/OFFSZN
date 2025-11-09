import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Configuración real de Supabase ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Nickname real del usuario o query string ---
const params = new URLSearchParams(window.location.search);
const nickname = params.get("nickname") || "WillieInspired"; // si no hay query string, carga tu usuario real

async function cargarPerfil() {
    const contenedor = document.getElementById("perfil");
    const productosCont = document.getElementById("productos-lista");

    if (!nickname) {
        contenedor.innerHTML = "<p>⚠️ No se indicó ningún usuario.</p>";
        return;
    }

    // --- Traer datos reales del usuario ---
    const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .ilike("nickname", nickname) // ignora mayúsculas/minúsculas
        .single();

    if (error || !user) {
        contenedor.innerHTML = `<p>❌ Usuario "${nickname}" no encontrado.</p>`;
        if (productosCont) productosCont.innerHTML = "";
        console.error(error);
        return;
    }

    // --- Aplicar plantilla ORIGINAL ---
    contenedor.className = `perfil-container original`;

    // --- Renderizar perfil ---
    contenedor.innerHTML = `
        <div class="perfil-card">
            <h1>${user.first_name || ""} ${user.last_name || ""}</h1>
            <p><b>Nickname:</b> ${user.nickname}</p>
            <p><b>Rol:</b> ${user.role || "No definido"}</p>
            <p><b>Estado:</b> ${user.estado || "No definido"}</p>
            <p><b>Bio:</b> ${user.bio || "No hay descripción"}</p>
            <p><b>Redes:</b> ${user.socials ? Object.values(user.socials).join(' | ') : 'No hay'}</p>
            <button onclick="window.location.href='/cuenta/messages.html?to=${user.nickname}'">
                Enviar mensaje
            </button>
        </div>
    `;

    // --- Cargar productos del usuario ---
    if (!productosCont) return;

    const { data: productos, error: errProd } = await supabase
        .from("productos")
        .select("*")
        .eq("usuario", user.nickname);

    if (errProd) {
        productosCont.innerHTML = "<p>❌ No se pudieron cargar los productos.</p>";
        console.error(errProd);
        return;
    }

    if (!productos || productos.length === 0) {
        productosCont.innerHTML = "<p>No tienes productos aún.</p>";
        return;
    }

    productosCont.innerHTML = productos.map(p => `
        <div class="producto-card">
            <h4>${p.nombre}</h4>
            <p>${p.descripcion || ""}</p>
            <p><b>Precio:</b> $${p.precio || "0"}</p>
        </div>
    `).join('');
}

document.addEventListener("DOMContentLoaded", cargarPerfil);
