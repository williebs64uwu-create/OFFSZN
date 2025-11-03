// ===============================================
// COLABORACIONES - JAVASCRIPT CORREGIDO
// ===============================================

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
// Elementos del DOM - Con verificación de existencia
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
// Helper: Obtener iniciales del nombre
// -------------------------
function getInitials(name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
}

// -------------------------
// Helper: Validar elementos del DOM
// -------------------------
function elementExists(element, name) {
    if (!element) {
        console.warn(`⚠️ Elemento no encontrado: ${name}`);
        return false;
    }
    return true;
}

// -------------------------
// Render de progreso semanal
// -------------------------
function renderWeeklyProgress() {
    if (!elementExists(progressCard, "progressCard")) return;
    
    try {
        progressCard.innerHTML = `Enviaste <strong>${weeklyProgress.sent} propuestas</strong> (${weeklyProgress.accepted} aceptadas, ${weeklyProgress.unread} sin leer)`;
    } catch (error) {
        console.error("Error al renderizar progreso semanal:", error);
    }
}

// -------------------------
// Render de colaboraciones activas
// -------------------------
function renderActiveCollaborations() {
    if (!elementExists(activeCollabsList, "activeCollabsList")) return;

    try {
        if (activeCollaborations.length === 0) {
            activeCollabsList.innerHTML = `<p class="no-active">No tienes colaboraciones activas.</p>`;
            return;
        }

        activeCollabsList.innerHTML = activeCollaborations.map(collab => `
            <div class="collab-item">
                <div class="collab-avatar">${getInitials(collab.partnerName)}</div>
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
                handleOpenChat(collabId);
            });
        });
    } catch (error) {
        console.error("Error al renderizar colaboraciones activas:", error);
        activeCollabsList.innerHTML = `<p class="no-active">Error al cargar colaboraciones.</p>`;
    }
}

// -------------------------
// Handler: Abrir chat
// -------------------------
function handleOpenChat(collabId) {
    const collab = activeCollaborations.find(c => c.id === parseInt(collabId));
    if (collab) {
        alert(`✅ Abriendo chat con ${collab.partnerName}...\n\n(Esto se conectará al sistema de mensajes)`);
        // Aquí podrías:
        // - Cambiar a la vista de mensajes
        // - Abrir un modal de chat
        // - Redirigir a otra página
    }
}

// -------------------------
// Helper para mostrar nombre legible del rol
// -------------------------
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
// Render dinámico de productores con filtros
// -------------------------
function renderProducers(filteredProducers = producers) {
    if (!elementExists(producersGrid, "producersGrid")) return;

    try {
        if (filteredProducers.length === 0) {
            producersGrid.innerHTML = `<p class="no-results">No se encontraron productores con esos filtros.</p>`;
            return;
        }

        producersGrid.innerHTML = filteredProducers.map(p => `
            <div class="producer-card" data-id="${p.id}">
                <div class="producer-avatar ${p.color}">
                    ${getInitials(p.name)}
                </div>
                <div class="producer-info">
                    <h3>
                        ${p.name} 
                        ${p.verified ? '<svg class="verified-badge" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' : ''}
                    </h3>
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

        // Agregar eventos a las tarjetas
        document.querySelectorAll(".producer-card").forEach(card => {
            card.addEventListener("click", () => {
                const id = parseInt(card.dataset.id);
                const producer = producers.find(p => p.id === id);
                if (producer) {
                    openModal(producer);
                }
            });
        });
    } catch (error) {
        console.error("Error al renderizar productores:", error);
        producersGrid.innerHTML = `<p class="no-results">Error al cargar productores.</p>`;
    }
}

// -------------------------
// Aplicar filtros
// -------------------------
function applyFilters() {
    try {
        const role = roleFilter?.value || "";
        const country = countryFilter?.value || "";
        const genre = genreFilter?.value || "";
        const availability = availabilityFilter?.value || "";

        const filtered = producers.filter(p => {
            if (role && p.role !== role) return false;
            if (country && p.country !== country) return false;
            if (genre && !p.genres.includes(genre)) return false;
            if (availability === "available" && !p.available) return false;
            if (availability === "busy" && p.available) return false;
            return true;
        });

        renderProducers(filtered);
    } catch (error) {
        console.error("Error al aplicar filtros:", error);
    }
}

// -------------------------
// Eventos de filtros
// -------------------------
function initializeFilters() {
    const filters = [roleFilter, countryFilter, genreFilter, availabilityFilter];
    
    filters.forEach(filter => {
        if (filter) {
            filter.addEventListener("change", applyFilters);
        }
    });
}

// -------------------------
// Sidebar toggle
// -------------------------
function initializeSidebar() {
    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });

        // Cerrar sidebar al hacer clic fuera (opcional)
        document.addEventListener("click", (e) => {
            if (sidebar.classList.contains("open") && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove("open");
            }
        });
    }
}

// -------------------------
// Cambio de vistas
// -------------------------
function initializeViews() {
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            // Remover clase active de todos los items
            menuItems.forEach(btn => btn.classList.remove("active"));
            
            // Agregar clase active al item clickeado
            item.classList.add("active");
            
            // Obtener la vista correspondiente
            const view = item.dataset.view;
            
            // Ocultar todas las vistas
            views.forEach(v => v.classList.remove("active"));
            
            // Mostrar la vista seleccionada
            const selectedView = document.getElementById(view + "View");
            if (selectedView) {
                selectedView.classList.add("active");
            }

            // Si se abre la vista de colaboraciones, renderizamos datos
            if (view === "collaborations") {
                renderWeeklyProgress();
                renderActiveCollaborations();
                renderProducers();
            }

            // Cerrar sidebar en mobile
            if (sidebar && window.innerWidth < 768) {
                sidebar.classList.remove("open");
            }
        });
    });
}

// -------------------------
// Modal
// -------------------------
function openModal(producer) {
    if (!modal || !modalName || !modalLocation || !modalAvatar) {
        console.error("Error: Elementos del modal no encontrados");
        return;
    }

    try {
        modal.classList.add("active");
        modalName.textContent = producer.name;
        modalLocation.textContent = producer.location;
        modalAvatar.className = `producer-avatar-large ${producer.color}`;
        modalAvatar.textContent = getInitials(producer.name);
        
        if (modalVerified) {
            modalVerified.style.display = producer.verified ? "inline" : "none";
        }

        // Prevenir scroll del body
        document.body.style.overflow = "hidden";
    } catch (error) {
        console.error("Error al abrir modal:", error);
    }
}

function closeModalHandler() {
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

function initializeModal() {
    if (closeModal) {
        closeModal.addEventListener("click", closeModalHandler);
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal-overlay")) {
                closeModalHandler();
            }
        });

        // Cerrar con tecla ESC
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("active")) {
                closeModalHandler();
            }
        });
    }
}

// -------------------------
// Botón de "Empieza tu primera colaboración"
// -------------------------
function initializeStartCollabButton() {
    if (startCollabBtn) {
        startCollabBtn.addEventListener("click", () => {
            try {
                // Cambiar a la vista de colaboraciones
                menuItems.forEach(btn => btn.classList.remove("active"));
                
                const collabItem = document.querySelector('.menu-item[data-view="collaborations"]');
                if (collabItem) {
                    collabItem.classList.add("active");
                    views.forEach(v => v.classList.remove("active"));
                    
                    const collabView = document.getElementById("collaborationsView");
                    if (collabView) {
                        collabView.classList.add("active");
                    }
                }

                // Renderizar contenido
                renderWeeklyProgress();
                renderActiveCollaborations();
                renderProducers();

                // Scroll suave al área de búsqueda
                setTimeout(() => {
                    const findSection = document.querySelector(".find-collaborators");
                    if (findSection) {
                        findSection.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }, 100);
            } catch (error) {
                console.error("Error al iniciar colaboración:", error);
            }
        });
    }
}

// -------------------------
// Botón de "Enviar propuesta de colaboración" en modal
// -------------------------
function initializeCollaborateButton() {
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("collaborate-btn")) {
            try {
                const producerName = modalName?.textContent || "este productor";
                closeModalHandler();
                
                alert(`✅ Propuesta de colaboración enviada a ${producerName}.\n\nPronto recibirás una notificación cuando responda.`);
                
                // Aquí podrías:
                // - Enviar petición a backend
                // - Actualizar weeklyProgress.sent++
                // - Añadir notificación en UI
                // - Actualizar estado local
                
                weeklyProgress.sent++;
                renderWeeklyProgress();
            } catch (error) {
                console.error("Error al enviar propuesta:", error);
            }
        }
    });
}

// -------------------------
// Función para toggle de dropdowns (navbar)
// -------------------------
window.toggleDropdown = function(element) {
    // Esta función puede ser usada por tu navbar
    // Implementación básica si es necesaria
    const parent = element.closest('.dropdown-parent');
    if (parent) {
        parent.classList.toggle('active');
    }
};

// -------------------------
// INICIALIZACIÓN PRINCIPAL
// -------------------------
function init() {
    console.log("🚀 Inicializando aplicación de colaboraciones...");

    try {
        // Inicializar componentes
        initializeSidebar();
        initializeViews();
        initializeModal();
        initializeFilters();
        initializeStartCollabButton();
        initializeCollaborateButton();

        // Renderizar contenido inicial
        renderProducers();

        console.log("✅ Aplicación inicializada correctamente");
    } catch (error) {
        console.error("❌ Error al inicializar la aplicación:", error);
    }
}

// -------------------------
// Esperar a que el DOM esté listo
// -------------------------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// -------------------------
// Exportar funciones si es necesario (para debugging)
// -------------------------
window.appDebug = {
    producers,
    activeCollaborations,
    weeklyProgress,
    renderProducers,
    renderActiveCollaborations,
    renderWeeklyProgress,
    applyFilters
};
