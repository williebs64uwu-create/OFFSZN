// ===============================================
// COLABORACIONES - JAVASCRIPT CON SKELETON LOADING
// ===============================================

// -------------------------
// Configuración de API
// -------------------------
let API_URL = '';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = 'http://localhost:3000/api';
} else {
    API_URL = 'https://offszn-academy.onrender.com/api';
}

// -------------------------
// Cache Keys
// -------------------------
const CACHE_KEY = 'offszn_user_cache';
const COLLAB_CACHE_KEY = 'offszn_collab_cache';

// -------------------------
// Datos de productores
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

// Elementos del perfil (para skeleton)
const profileAvatar = document.querySelector('.profile-avatar');
const profileName = document.querySelector('.profile-name');
const walletAmount = document.querySelector('.wallet-amount');

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
// SKELETON LOADING SYSTEM
// -------------------------
function showSkeletonLoading() {
    // Avatar
    if (profileAvatar) {
        profileAvatar.classList.add('skeleton');
        profileAvatar.textContent = '';
    }
    
    // Nombre
    if (profileName) {
        profileName.classList.add('skeleton');
        profileName.textContent = 'Cargando...';
    }
    
    // Saldo
    if (walletAmount) {
        walletAmount.classList.add('skeleton');
        walletAmount.textContent = '$0.00';
    }
}

function hideSkeletonLoading() {
    // Remover skeleton con fade-in
    document.querySelectorAll('.skeleton').forEach(el => {
        el.classList.remove('skeleton');
        el.classList.add('fade-in');
    });
}

// -------------------------
// CACHE SYSTEM
// -------------------------
function loadCachedUser() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const cachedData = JSON.parse(cached);
            console.log('✅ Cargando datos desde caché...');
            updateUserUI(cachedData, true);
            return true;
        }
    } catch (err) {
        console.error('Error al cargar caché:', err);
    }
    return false;
}

function saveUserCache(userData) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(userData));
    } catch (err) {
        console.error('Error al guardar caché:', err);
    }
}

// -------------------------
// UPDATE USER UI
// -------------------------
function updateUserUI(userData, fromCache = false) {
    if (profileName) {
        const displayName = userData.nickname || userData.first_name || 'Usuario';
        profileName.textContent = displayName;
        profileName.classList.remove('skeleton');
        profileName.classList.add('fade-in');
    }

    if (profileAvatar) {
        const initial = (userData.first_name || userData.nickname || 'U').charAt(0).toUpperCase();
        profileAvatar.textContent = initial;
        profileAvatar.classList.remove('skeleton');
        profileAvatar.classList.add('fade-in');
    }

    // El saldo se manejará separadamente si existe en userData
    if (walletAmount && userData.balance !== undefined) {
        walletAmount.textContent = `$${userData.balance.toFixed(2)}`;
        walletAmount.classList.remove('skeleton');
        walletAmount.classList.add('fade-in');
    } else if (walletAmount) {
        // Si no hay balance en userData, dejamos el skeleton o ponemos $0.00
        walletAmount.textContent = '$0.00';
        walletAmount.classList.remove('skeleton');
    }

    if (!fromCache) {
        hideSkeletonLoading();
    }
}

// -------------------------
// LOAD USER DATA FROM API
// -------------------------
async function loadUserData() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        console.warn('⚠️ No hay token de autenticación');
        hideSkeletonLoading();
        return null;
    }

    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudieron obtener los datos del usuario`);
        }

        const userData = await response.json();
        console.log('✅ Datos del usuario cargados:', userData);

        // Guardar en caché
        saveUserCache(userData);

        // Actualizar UI con datos frescos
        updateUserUI(userData, false);

        return userData;
    } catch (error) {
        console.error('❌ Error al cargar datos del usuario:', error);
        hideSkeletonLoading();
        
        // Si falla, al menos quitamos los skeletons
        if (profileName) profileName.textContent = 'Usuario';
        if (profileAvatar) profileAvatar.textContent = 'U';
        if (walletAmount) walletAmount.textContent = '$0.00';
        
        return null;
    }
}

// -------------------------
// Helper: Obtener iniciales
// -------------------------
function getInitials(name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
}

// -------------------------
// Helper: Validar elementos DOM
// -------------------------
function elementExists(element, name) {
    if (!element) {
        console.warn(`⚠️ Elemento no encontrado: ${name}`);
        return false;
    }
    return true;
}

// -------------------------
// Render progreso semanal
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
// Render colaboraciones activas
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
    }
}

// -------------------------
// Helper rol legible
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
// Render productores con filtros
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
// Inicializar filtros
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
// Cambio de vistas + Mensajes "Próximamente"
// -------------------------
function initializeViews() {
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            menuItems.forEach(btn => btn.classList.remove("active"));
            item.classList.add("active");
            
            const view = item.dataset.view;
            
            // Verificar si es una vista "próximamente"
            if (view === 'blog' || view === 'analytics' || view === 'history') {
                showComingSoonMessage(view);
                return;
            }
            
            views.forEach(v => v.classList.remove("active"));
            
            const selectedView = document.getElementById(view + "View");
            if (selectedView) {
                selectedView.classList.add("active");
            }

            if (view === "collaborations") {
                renderWeeklyProgress();
                renderActiveCollaborations();
                renderProducers();
            }

            if (sidebar && window.innerWidth < 768) {
                sidebar.classList.remove("open");
            }
        });
    });
}

// -------------------------
// Mensaje "Próximamente disponible"
// -------------------------
function showComingSoonMessage(feature) {
    const featureNames = {
        'blog': 'Blog',
        'analytics': 'Analíticas',
        'history': 'Historial'
    };
    
    const featureName = featureNames[feature] || feature;
    
    // Crear overlay temporal
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    
    const message = document.createElement('div');
    message.style.cssText = `
        background: linear-gradient(135deg, #1f2937, #111827);
        border: 1px solid rgba(147, 51, 234, 0.3);
        border-radius: 16px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: slideUp 0.4s ease;
    `;
    
    message.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">🚀</div>
        <h2 style="color: #fff; font-size: 24px; font-weight: 700; margin-bottom: 12px;">
            ${featureName} - Próximamente
        </h2>
        <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Esta función estará disponible muy pronto. Te notificaremos por correo electrónico cuando esté lista para usar.
        </p>
        <button onclick="this.closest('[style*=fixed]').remove()" style="
            background: linear-gradient(135deg, #9333ea, #7e22ce);
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.2s;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            Entendido
        </button>
    `;
    
    overlay.appendChild(message);
    document.body.appendChild(overlay);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 5000);
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

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && modal.classList.contains("active")) {
                closeModalHandler();
            }
        });
    }
}

// -------------------------
// Botón "Empieza tu primera colaboración"
// -------------------------
function initializeStartCollabButton() {
    if (startCollabBtn) {
        startCollabBtn.addEventListener("click", () => {
            try {
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

                renderWeeklyProgress();
                renderActiveCollaborations();
                renderProducers();

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
// Botón "Colaborar" en modal
// -------------------------
function initializeCollaborateButton() {
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("collaborate-btn")) {
            try {
                const producerName = modalName?.textContent || "este productor";
                closeModalHandler();
                
                alert(`✅ Propuesta de colaboración enviada a ${producerName}.\n\nPronto recibirás una notificación cuando responda.`);
                
                weeklyProgress.sent++;
                renderWeeklyProgress();
            } catch (error) {
                console.error("Error al enviar propuesta:", error);
            }
        }
    });
}

// -------------------------
// INICIALIZACIÓN PRINCIPAL
// -------------------------
async function init() {
    console.log("🚀 Inicializando aplicación de colaboraciones...");

    try {
        // 1. Mostrar skeletons inmediatamente
        showSkeletonLoading();

        // 2. Cargar caché primero (instantáneo)
        const hasCachedData = loadCachedUser();

        // 3. Inicializar componentes
        initializeSidebar();
        initializeViews();
        initializeModal();
        initializeFilters();
        initializeStartCollabButton();
        initializeCollaborateButton();

        // 4. Renderizar contenido inicial
        renderProducers();

        // 5. Cargar datos frescos del servidor (asíncrono)
        await loadUserData();

        console.log("✅ Aplicación inicializada correctamente");
    } catch (error) {
        console.error("❌ Error al inicializar la aplicación:", error);
        hideSkeletonLoading();
    }
}

// -------------------------
// Esperar DOM
// -------------------------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

// -------------------------
// Debug utilities
// -------------------------
window.appDebug = {
    producers,
    activeCollaborations,
    weeklyProgress,
    renderProducers,
    renderActiveCollaborations,
    renderWeeklyProgress,
    applyFilters,
    showComingSoonMessage
};
