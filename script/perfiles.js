import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// --- Configuración real de Supabase ---
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Nickname real del usuario o query string ---
const params = new URLSearchParams(window.location.search);
const nickname = params.get("nickname") || "WillieInspired"; // usuario por defecto

async function cargarPerfil() {
    const contenedor = document.getElementById("perfil");

    if (!nickname) {
        contenedor.innerHTML = "<p>⚠️ No se indicó ningún usuario.</p>";
        return;
    }

    // --- Traer datos reales del usuario ---
    const { data: user, error } = await supabase
        .from("users")
        .select('id, nickname, first_name, last_name, role, "Estado", socials, template')
        .ilike("nickname", nickname)
        .single();

    if (error || !user) {
        contenedor.innerHTML = `<p>❌ Usuario "${nickname}" no encontrado.</p>`;
        console.error(error);
        return;
    }

    // --- Aplicar plantilla ---
    const template = user.template || 'original';
    contenedor.className = `perfil-container ${template}`;

    // --- Renderizar perfil ---
    contenedor.innerHTML = `
        <div class="perfil-card">
            <h1>${user.first_name || ""} ${user.last_name || ""}</h1>
            <p><b>Nickname:</b> ${user.nickname}</p>
            <p><b>Rol:</b> ${user.role || "No definido"}</p>
            <p><b>Estado:</b> ${user.Estado || "No definido"}</p>
            <p><b>Redes:</b> ${user.socials ? Object.entries(user.socials).map(([k,v]) => `${k}: ${v}`).join(' | ') : 'No hay'}</p>
        </div>
    `;

    // --- Cargar productos del usuario ---
    const productosCont = document.getElementById("productos-lista");
    if (!productosCont) return; // si no hay sección de productos, no hacer nada

    const { data: productos, error: errProd } = await supabase
        .from("products")
        .select("*")
        .eq("producer_id", user.id); // usamos el ID real del usuario

    if (errProd) {
        productosCont.innerHTML = "<p>❌ No se pudieron cargar los productos.</p>";
        console.error(errProd);
        return;
    }

    if (!productos || productos.length === 0) {
        productosCont.innerHTML = "<p>No hay productos para este usuario.</p>";
        return;
    }

    productosCont.innerHTML = productos.map(p => `
        <div class="producto-card">
            <img src="${p.image_url}" alt="${p.name}" />
            <h4>${p.name}</h4>
            <p>${p.description || ""}</p>
            <p><b>Precio:</b> ${p.is_free ? "Gratis" : "$" + (p.price_basic || "0")}</p>
        </div>
    `).join('');
}

document.addEventListener("DOMContentLoaded", cargarPerfil);
