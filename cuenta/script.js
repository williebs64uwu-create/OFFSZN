// -------------------------
// Datos de productores actualizados
// -------------------------
const producers = [
    {
        id: 1,
        name: "Stein en la pista",
        location: "USA",
        country: "us",
        role: "producer",
        genres: ["trap", "hiphop"],
        available: true,
        type: "50% DE DESCUENTO HOY",
        verified: true,
        color: "bg-blue-400"
    },
    {
        id: 2,
        name: "Dakota Parker",
        location: "Los Ángeles, USA",
        country: "us",
        role: "vocalist",
        genres: ["rnb", "pop"],
        available: true,
        type: "ANUNCIO",
        verified: true,
        color: "bg-blue-600"
    },
    {
        id: 3,
        name: "Productor Fix",
        location: "Madrid, España",
        country: "es",
        role: "producer",
        genres: ["reggaeton", "trap"],
        available: false,
        type: "ANUNCIO",
        verified: false,
        color: "bg-gray-400"
    },
    {
        id: 4,
        name: "MAGNATE",
        location: "Sídney, Australia",
        country: "au",
        role: "instrumentalist",
        genres: ["hiphop", "pop"],
        available: true,
        type: "",
        verified: false,
        color: "bg-black"
    },
    {
        id: 5,
        name: "Robar incluso",
        location: "Buenos Aires, Argentina",
        country: "ar",
        role: "mixer",
        genres: ["trap", "reggaeton"],
        available: true,
        type: "",
        verified: true,
        color: "bg-gray-600"
    },
    {
        id: 6,
        name: "THAIBEATS",
        location: "Bangkok, Tailandia",
        country: "th",
        role: "producer",
        genres: ["trap", "hiphop"],
        available: false,
        type: "",
        verified: true,
        color: "bg-red-500"
    }
];

// -------------------------
// Datos de colaboraciones activas (simuladas)
// -------------------------
const activeCollaborations = [
    {
        id: 101,
        partnerName: "Alex Beats",
        status: "En progreso",
        lastMessage: "Hoy"
    },
    {
        id: 102,
        partnerName: "Luna Vocals",
        status: "Esperando respuesta",
        lastMessage: "Ayer"
    }
];

// -------------------------
// Progreso semanal (simulado)
// -------------------------
const weeklyProgress = {
    sent: 3,
    accepted: 2,
    unread: 1
};

// -------------------------
// Elementos del DOM
// -------------------------
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const menuItems = document.querySelectorAll(".menu-item");
const views = document.querySelectorAll(".view");
const producersGrid = document.getElementById("producersGrid");

// Filtros
const roleFilter = document.getElementById("roleFilter");
const countryFilter = document.getElementById("countryFilter");
const genreFilter = document.getElementById("genreFilter");
const availabilityFilter = document.getElementById("availabilityFilter");

// Progreso semanal
const progressCard = document.querySelector(".progress-card p");

// Colaboraciones activas
const activeCollabsList = document.querySelector(".active-collabs-list");

// Modal
const modal = document.getElementById("producerModal");
const closeModal = document.getElementById("closeModal");
const modalName = document.getElementById("modalName");
const modalLocation = document.getElementById("modalLocation");
const modalAvatar = document.getElementById("modalAvatar");
const modalVerified = document.getElementById("modalVerified");

// Botón de "Empieza tu primera colaboración"
const startCollabBtn = document.querySelector(".start-collab-btn");

// -------------------------
// Render de progreso semanal
// -------------------------
function renderWeeklyProgress() {
    if (progressCard) {
        progressCard.innerHTML = `Enviaste <strong>${weeklyProgress.sent} propuestas</strong> (${weeklyProgress.accepted} aceptadas, ${weeklyProgress.unread} sin leer)`;
    }
}

// -------------------------
// Render de colaboraciones activas
// -------------------------
function renderActiveCollaborations() {
    if (!activeCollabsList) return;

    if (activeCollaborations.length === 0) {
        activeCollabsList.innerHTML = `<p class="no-active">No tienes colaboraciones activas.</p>`;
        return;
    }

    activeCollabsList.innerHTML = activeCollaborations.map(collab => `
        <div class="collab-item">
            <div class="collab-avatar"></div>
            <div class="collab-info">
                <h4>Colaboración con ${collab.partnerName}</h4>
                <p>Estado: ${collab.status} • Último mensaje: ${collab.lastMessage}</p>
            </div>
            <button class="btn-chat" data-collab-id="${collab.id}">Abrir chat</button>
        </div>
    `).join("");

    // Evento para abrir chat
    document.querySelectorAll(".btn-chat").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const collabId = e.currentTarget.dataset.collabId;
            alert(`Abriendo chat con colaboración #${collabId}... (esto se conectará al sistema de mensajes)`);
            // Aquí podrías redirigir a la vista de mensajes o abrir un chat en modal
        });
    });
}

// -------------------------
// Render dinámico de productores con filtros
// -------------------------
function renderProducers(filteredProducers = producers) {
    if (!producersGrid) return;

    if (filteredProducers.length === 0) {
        producersGrid.innerHTML = `<p class="no-results">No se encontraron productores con esos filtros.</p>`;
        return;
    }

    producersGrid.innerHTML = filteredProducers.map(p => `
        <div class="producer-card" data-id="${p.id}">
            <div class="producer-avatar ${p.color}"></div>
            <div class="producer-info">
                <h3>${p.name} ${p.verified ? '<svg class="verified-badge" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' : ''}</h3>
                <p>${p.location}</p>
                <div class="producer-meta">
                    <span class="meta-role">${getRoleLabel(p.role)}</span>
                    <span class="meta-genre">${p.genres.slice(0, 2).join(", ")}</span>
                    <span class="meta-availability ${p.available ? 'available' : 'busy'}">
                        ${p.available ? 'Disponible' : 'Ocupado'}
                    </span>
                </div>
                ${p.type ? `<span class="producer-type">${p.type}</span>` : ""}
            </div>
        </div>
    `).join("");

    document.querySelectorAll(".producer-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.dataset.id);
            const producer = producers.find(p => p.id === id);
            openModal(producer);
        });
    });
}

// Helper para mostrar nombre legible del rol
function getRoleLabel(role) {
    const labels = {
        producer: "Productor",
        vocalist: "Cantante",
        instrumentalist: "Instrumentista",
        mixer: "Mezclador"
    };
    return labels[role] || role;
}

// -------------------------
// Aplicar filtros
// -------------------------
function applyFilters() {
    const role = roleFilter.value;
    const country = countryFilter.value;
    const genre = genreFilter.value;
    const availability = availabilityFilter.value;

    const filtered = producers.filter(p => {
        if (role && p.role !== role) return false;
        if (country && p.country !== country) return false;
        if (genre && !p.genres.includes(genre)) return false;
        if (availability === "available" && !p.available) return false;
        if (availability === "busy" && p.available) return false;
        return true;
    });

    renderProducers(filtered);
}

// -------------------------
// Eventos de filtros
// -------------------------
[roleFilter, countryFilter, genreFilter, availabilityFilter].forEach(filter => {
    filter.addEventListener("change", applyFilters);
});

// -------------------------
// Sidebar toggle
// -------------------------
menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

// -------------------------
// Cambio de vistas
// -------------------------
menuItems.forEach(item => {
    item.addEventListener("click", () => {
        menuItems.forEach(btn => btn.classList.remove("active"));
        item.classList.add("active");
        const view = item.dataset.view;
        views.forEach(v => {
            v.classList.remove("active");
            if (v.id === view + "View") v.classList.add("active");
        });

        // Si se abre la vista de colaboraciones, renderizamos datos
        if (view === "collaborations") {
            renderWeeklyProgress();
            renderActiveCollaborations();
            renderProducers(); // Opcional: mostrar productores para colaborar
        }
    });
});

// -------------------------
// Modal
// -------------------------
function openModal(producer) {
    modal.classList.add("active");
    modalName.textContent = producer.name;
    modalLocation.textContent = producer.location;
    modalAvatar.className = `producer-avatar-large ${producer.color}`;
    modalVerified.style.display = producer.verified ? "inline" : "none";
}

closeModal.addEventListener("click", () => modal.classList.remove("active"));
modal.addEventListener("click", e => {
    if (e.target.classList.contains("modal-overlay")) {
        modal.classList.remove("active");
    }
});

// -------------------------
// Botón de "Empieza tu primera colaboración"
// -------------------------
if (startCollabBtn) {
    startCollabBtn.addEventListener("click", () => {
        // Cambiar a la vista de colaboraciones
        menuItems.forEach(btn => btn.classList.remove("active"));
        const collabItem = document.querySelector('.menu-item[data-view="collaborations"]');
        if (collabItem) {
            collabItem.classList.add("active");
            views.forEach(v => v.classList.remove("active"));
            document.getElementById("collaborationsView").classList.add("active");
        }

        // Renderizar contenido
        renderWeeklyProgress();
        renderActiveCollaborations();
        renderProducers();

        // Scroll suave al área de búsqueda
        document.querySelector(".find-collaborators")?.scrollIntoView({ behavior: "smooth" });
    });
}

// -------------------------
// Botón de "Enviar propuesta de colaboración" en modal
// -------------------------
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("collaborate-btn")) {
        const producerName = modalName.textContent;
        modal.classList.remove("active");
        alert(`✅ Propuesta de colaboración enviada a ${producerName}.\n\nPronto recibirás una notificación cuando responda.`);
        // Aquí podrías:
        // - Enviar petición a backend
        // - Actualizar weeklyProgress
        // - Añadir notificación en UI
    }
});

// -------------------------
// Inicializar
// -------------------------
renderProducers();