/**
 * OFFSZN Services Manager
 * Handles dynamic services and playlists for producer profiles.
 */

window.ServicesManager = {
    currentAction: null, // 'service' or 'playlist'
    userBeats: [],
    selectedTracks: [],

    init() {
        console.log("ServicesManager initialized");
        this.injectModals();
    },

    injectModals() {
        if (document.getElementById('servicesModalOffszn')) return;

        const modalHtml = `
            <!-- Services Management Modal -->
            <style>
                #servicesModalOffszn * { scrollbar-width: thin; scrollbar-color: #333 transparent; }
                #servicesModalOffszn *::-webkit-scrollbar { width: 6px; }
                #servicesModalOffszn *::-webkit-scrollbar-track { background: transparent; }
                #servicesModalOffszn *::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }

                .offszn-input-field { width: 100%; padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #fff; transition: all 0.2s ease; font-family: inherit; font-size: 0.95rem; }
                .offszn-input-field:focus { outline: none; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
                .offszn-input-field::placeholder { color: #555; }
                .offszn-label { font-size: 0.7rem; color: #666; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; display: block; }
                
                /* Custom Dropdown */
                .custom-select-container { position: relative; width: 100%; margin-bottom: 16px; }
                .custom-select-trigger { 
                    padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
                    border-radius: 12px; color: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center;
                    font-size: 0.95rem; transition: all 0.2s;
                }
                .custom-select-trigger:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
                .custom-options { 
                    position: absolute; top: calc(100% + 5px); left: 0; right: 0; background: #0f1012; 
                    border: 1px solid #1a1b1e; border-radius: 12px; display: none; z-index: 100; max-height: 250px; overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 8px;
                }
                .custom-option { 
                    padding: 10px 14px; cursor: pointer; border-radius: 8px; transition: all 0.2s; font-size: 0.9rem; color: #aaa;
                }
                .custom-option:hover { background: rgba(255,255,255,0.05); color: #fff; }
                .custom-option.selected { background: rgba(255,255,255,0.08); color: #fff; font-weight: 600; }
                .custom-options.show { display: block; animation: selectFade 0.2s ease-out; }
                @keyframes selectFade { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

                .price-input-wrapper { 
                    display: flex; align-items: center; background: rgba(255,255,255,0.03); 
                    border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; margin-bottom: 16px; transition: all 0.2s;
                }
                .price-input-wrapper:focus-within { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); }
                .price-input-wrapper span { padding-left: 16px; color: #666; font-weight: 600; font-size: 1rem; }
                .price-input-wrapper input { 
                    width: 100%; padding: 14px 14px 14px 8px; background: transparent; border: none; color: #fff; 
                    font-family: inherit; font-size: 1rem; outline: none; 
                }
                .price-input-wrapper input::placeholder { color: #444; }

                /* Group-Style Selection Chips */
                .playlist-stack-container {
                    display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 0; transition: margin 0.3s ease;
                }
                .playlist-stack-container:not(:empty) { margin-bottom: 20px; }

                .stack-chip {
                    display: flex; align-items: center; gap: 8px; padding: 6px 10px;
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 100px; animation: chipEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    cursor: default; transition: all 0.2s;
                }
                .stack-chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); }
                .stack-chip img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
                .stack-chip span { font-size: 0.75rem; font-weight: 700; color: #fff; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .chip-remove { cursor: pointer; color: #666; transition: color 0.2s; display: flex; align-items: center; }
                .chip-remove:hover { color: #ff4d4d; }

                @keyframes chipEnter { from { opacity: 0; transform: scale(0.8) translateY(5px); } to { opacity: 1; transform: scale(1) translateY(0); } }

                /* Category Pills & Item Hover Refinements */
                .cat-pill {
                    padding: 6px 14px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 100px; color: #fff; font-size: 0.65rem; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .cat-pill:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.4); }
                .cat-pill.active { background: #fff; color: #000; border-color: #fff; box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2); }
                
                .beat-selector-item:hover { background: rgba(255, 255, 255, 0.04) !important; }
                .beat-selector-item:hover div:last-child { opacity: 1 !important; }

                /* Skeletons */
                @keyframes shimmer-srv {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .srv-skeleton {
                    background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
                    background-size: 200% 100%;
                    animation: shimmer-srv 1.5s infinite;
                    border-radius: 4px;
                }
            </style>
            <div id="servicesModalOffszn" class="p-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 10000; backdrop-filter: blur(20px); color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;">
                <div class="p-modal-content" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 560px; background: #0c0c0c; border: 1px solid #1a1a1a; border-radius: 28px; overflow: hidden; box-shadow: 0 50px 120px rgba(0,0,0,0.95);">
                    <div class="p-modal-header" style="padding: 24px 32px; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; align-items: center;">
                        <h3 id="servicesModalTitle" style="margin: 0; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.3px;">Añadir Servicio</h3>
                        <button onclick="window.ServicesManager.closeAddModal()" style="background: rgba(255,255,255,0.04); border: none; color: #666; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; display:flex; align-items:center; justify-content:center; cursor: pointer; transition: all 0.2s;">&times;</button>
                    </div>
                    <div class="p-modal-main-view" style="padding: 32px; display: flex; flex-direction: column; max-height: 85vh; overflow-y: auto;">
                        <div id="serviceFields">
                            <label class="offszn-label">Categoría</label>
                            <div class="custom-select-container">
                                <div id="categoryTrigger" class="custom-select-trigger" onclick="window.ServicesManager.toggleDropdown()">
                                    <span id="selectedCategoryText">Mix y master</span>
                                    <i class="bi bi-chevron-down" style="font-size: 0.8rem; opacity: 0.5;"></i>
                                </div>
                                <div id="categoryOptions" class="custom-options">
                                    <div class="custom-option selected" onclick="window.ServicesManager.selectCategory('Mix y master')">Mix y master</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Producción completa')">Producción completa</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Mezcla de voces')">Mezcla de voces</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Master')">Master</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Remake de beats')">Remake de beats</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Preset de voces')">Preset de voces</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Plantilla de voces')">Plantilla de voces</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Grabación de voces')">Grabación de voces</div>
                                    <div class="custom-option" onclick="window.ServicesManager.selectCategory('Otro')">Otro</div>
                                </div>
                                <input type="hidden" id="serviceCategory" value="Mix y master">
                            </div>

                            <div id="customTagGroup" style="display: none; margin-bottom: 20px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label class="offszn-label" style="margin:0;">Etiqueta Personalizada</label>
                                    <span id="tagCounter" style="font-size: 0.6rem; color: #444;">0/20</span>
                                </div>
                                <input type="text" id="serviceCustomTag" class="offszn-input-field" maxlength="20" placeholder="Ej: Remix">
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label class="offszn-label" style="margin:0;">Título del Servicio</label>
                                <span id="titleCounter" style="font-size: 0.6rem; color: #444;">0/30</span>
                            </div>
                            <input type="text" id="serviceTitle" class="offszn-input-field" maxlength="30" placeholder="Ej: Mezcla Analógica de alta calidad" style="margin-bottom: 20px;">
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label class="offszn-label" style="margin:0;">Descripción</label>
                                <span id="descCounter" style="font-size: 0.6rem; color: #444;">0/150</span>
                            </div>
                            <textarea id="serviceDesc" class="offszn-input-field" maxlength="150" placeholder="Breve detalle sobre lo que ofreces..." style="margin-bottom: 20px; min-height: 100px; resize: none;"></textarea>
                            
                            <label class="offszn-label">Link (Spotify, Youtube, Soundcloud)</label>
                            <input type="text" id="serviceLink" class="offszn-input-field" placeholder="https://..." oninput="window.ServicesManager.validateLink(this.value)">
                            <p id="linkError" style="display: none; font-size: 0.7rem; color: #fa5252; margin: 8px 0 0 4px; font-weight: 500;">Link no válido (Plataforma no soportada)</p>
                            <div style="height: 20px;"></div>
                            
                            <label class="offszn-label">Precio (USD, Máx $1000)</label>
                            <div class="price-input-wrapper">
                                <span>$</span>
                                <input type="number" id="servicePrice" max="1000" placeholder="50">
                            </div>
                        </div>

                        <div id="playlistFields" style="display: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label class="offszn-label" style="margin:0;">Nombre de la Playlist</label>
                                <span id="playlistTitleCounter" style="font-size: 0.6rem; color: #444;">0/30</span>
                            </div>
                            <input type="text" id="playlistTitle" class="offszn-input-field" maxlength="30" placeholder="Title" style="margin-bottom: 24px;" oninput="window.ServicesManager.updatePlaylistCounter()">
                            
                            <label class="offszn-label">Categoría de la Playlist</label>
                            <div class="playlist-category-pills" style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;">
                                <div class="cat-pill active" onclick="window.ServicesManager.setPlaylistCategory('beat', this)">Beats</div>
                                <div class="cat-pill" onclick="window.ServicesManager.setPlaylistCategory('preset', this)">Presets/Plantillas</div>
                                <div class="cat-pill" onclick="window.ServicesManager.setPlaylistCategory('drumkit', this)">Drumkits</div>
                                <div class="cat-pill" onclick="window.ServicesManager.setPlaylistCategory('loopkit', this)">Loopkits</div>
                            </div>
                            <input type="hidden" id="playlistCategory" value="beat">

                            <div id="beatSelectorArea">
                                <label class="offszn-label">Añadir Productos</label>
                                <div id="playlistStack" class="playlist-stack-container">
                                    <!-- Selected items will chips here -->
                                </div>
                                
                                <div style="margin-bottom: 12px;" id="beatDropdownContainer">
                                    <div style="position: relative;">
                                        <i class="bi bi-search" style="position: absolute; left: 12px; top: 14px; color: #444;"></i>
                                        <input type="text" id="beatSelectorSearch" class="offszn-input-field" placeholder="Buscar en tu catálogo..." style="padding-left: 36px; height: 44px; font-size: 0.85rem;" oninput="window.ServicesManager.filterSelector(this.value)">
                                    </div>
                                    
                                    <div id="beatSelectorDropdownList" style="margin-top: 8px; background: #080808; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;">
                                        <!-- Limit to roughly 2 items with scroll -->
                                        <div id="beatSelectorList" class="beat-selector-list" style="max-height: 180px; overflow-y: auto;">
                                            <!-- Results will be rendered here -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button id="saveItemBtn" onclick="window.ServicesManager.saveItem()" style="width: 100%; padding: 18px; margin-top: 24px; background: #fff; color: #000; border: none; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 0.95rem;">Guardar</button>
                    </div>
                </div>
            </div>

            <!-- Upgrade Modal Premium -->
            <div id="upgradeModalOffszn" class="p-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10001; backdrop-filter: blur(15px); color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;">
                <div class="p-modal-content" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 24px; overflow: hidden; text-align: center; padding: 48px 32px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 24px; background: linear-gradient(180deg, #333, #111); border-radius: 16px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.1);">
                        <i class="bi bi-lightning-fill" style="font-size: 2rem; color: #fff;"></i>
                    </div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 16px;">Mejora tu cuenta ahora</h2>
                    <p style="color: #888; margin-bottom: 32px; font-size: 0.95rem; line-height: 1.5;">Para usar estas funciones necesitas una cuenta PRO. Actualiza ahora y obtén beneficios exclusivos en minutos.</p>
                    
                    <div style="text-align: left; margin-bottom: 32px; font-size: 0.95rem; display: flex; flex-direction: column; gap: 14px; padding: 0 8px;">
                        <div style="display: flex; align-items: center; color: #ccc;"><i class="bi bi-check2" style="color: #fff; margin-right: 12px; font-size: 1.2rem;"></i> Catálogo de servicios ilimitado (hasta 5)</div>
                        <div style="display: flex; align-items: center; color: #ccc;"><i class="bi bi-check2" style="color: #fff; margin-right: 12px; font-size: 1.2rem;"></i> Crea tus 5 playlists exclusivas</div>
                        <div style="display: flex; align-items: center; color: #ccc;"><i class="bi bi-check2" style="color: #fff; margin-right: 12px; font-size: 1.2rem;"></i> Destaca con insignia Verificado</div>
                    </div>

                    <button onclick="window.location.href='/pages/pricing.html'" style="background: #fff; color: #000; width: 100%; padding: 16px; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 1rem; margin-bottom: 16px; transition: opacity 0.2s;">REGISTRARSE Y MEJORAR</button>
                    <button onclick="window.ServicesManager.closeUpgradeModal()" style="background: transparent; border: none; color: #666; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: color 0.2s;">Quizás más tarde</button>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div);
    },

    openAddModal(type, isEdit = false) {
        const user = window.currentUserProfile;
        if (user && !isEdit) {
            const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});
            if (type === 'service') {
                if ((socials.custom_services || []).length >= 5) return alert("Has alcanzado el límite máximo de 5 servicios.");
            } else {
                if ((socials.playlists || []).length >= 5) return alert("Has alcanzado el límite máximo de 5 playlists.");
            }
        }

        if (!isEdit) this.editingItemId = null;
        this.currentAction = type;
        const modal = document.getElementById('servicesModalOffszn');
        const title = document.getElementById('servicesModalTitle');
        const serviceFields = document.getElementById('serviceFields');
        const playlistFields = document.getElementById('playlistFields');

        // Reset fields if not editing
        if (type === 'service') {
            title.innerText = isEdit ? 'Editar Servicio' : 'Añadir Servicio';
            serviceFields.style.display = 'block';
            playlistFields.style.display = 'none';
            
            document.getElementById('saveItemBtn').innerText = 'Guardar Cambios';
            
            if (!isEdit) {
                // Clear inputs
                document.getElementById('serviceCategory').value = 'Mix y master';
                document.getElementById('serviceCustomTag').value = '';
                document.getElementById('serviceTitle').value = '';
                document.getElementById('serviceDesc').value = '';
                document.getElementById('serviceLink').value = '';
                document.getElementById('servicePrice').value = '';
                document.getElementById('customTagGroup').style.display = 'none';
                document.getElementById('linkError').style.display = 'none';
                this.updateCounters();
            }
            this.setupListeners();
        } else {
            title.innerText = isEdit ? 'Editar Playlist' : 'Nueva Playlist';
            serviceFields.style.display = 'none';
            playlistFields.style.display = 'block';
            
            document.getElementById('saveItemBtn').innerText = 'Guardar Cambios';
            
            if (!isEdit) {
                document.getElementById('playlistTitle').value = '';
                document.getElementById('playlistCategory').value = 'beat';
                document.getElementById('playlistTitleCounter').innerText = '0/30';
                
                // Reset active pill
                document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                const firstPill = document.querySelector('.cat-pill:first-child');
                if (firstPill) firstPill.classList.add('active');

                // Initialize Playlist Selector
                this.selectedTracks = [];
                document.getElementById('playlistStack').innerHTML = '';
                document.getElementById('beatSelectorSearch').value = '';
                this.loadUserBeats();
            }
        }

        modal.style.display = 'block';
    },

    toggleDropdown() {
        const options = document.getElementById('categoryOptions');
        if (options) options.classList.toggle('show');
    },

    selectCategory(val) {
        const triggerText = document.getElementById('selectedCategoryText');
        const hiddenInput = document.getElementById('serviceCategory');
        const options = document.getElementById('categoryOptions');
        
        if (triggerText) triggerText.innerText = val;
        if (hiddenInput) hiddenInput.value = val;
        if (options) options.classList.remove('show');
        
        // Update visual selection state
        const opts = document.querySelectorAll('.custom-option');
        opts.forEach(o => {
            if (o.innerText === val) o.classList.add('selected');
            else o.classList.remove('selected');
        });

        this.handleCategoryChange();
    },

    handleCategoryChange() {
        const cat = document.getElementById('serviceCategory').value;
        const customGroup = document.getElementById('customTagGroup');
        if (customGroup) customGroup.style.display = (cat === 'Otro') ? 'block' : 'none';
        
        // Close dropdown just in case
        const options = document.getElementById('categoryOptions');
        if (options) options.classList.remove('show');
    },

    updateCounters() {
        const title = document.getElementById('serviceTitle');
        const desc = document.getElementById('serviceDesc');
        const tag = document.getElementById('serviceCustomTag');
        
        if (title && document.getElementById('titleCounter')) 
            document.getElementById('titleCounter').innerText = `${title.value.length}/30`;
        if (desc && document.getElementById('descCounter')) 
            document.getElementById('descCounter').innerText = `${desc.value.length}/150`;
        if (tag && document.getElementById('tagCounter')) 
            document.getElementById('tagCounter').innerText = `${tag.value.length}/20`;
    },

    setupListeners() {
        const fields = ['serviceTitle', 'serviceDesc', 'serviceCustomTag'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.oninput = () => this.updateCounters();
            }
        });
    },

    validateLink(url) {
        const errorEl = document.getElementById('linkError');
        if (!url) {
            errorEl.style.display = 'none';
            return true;
        }

        const isSpotify = url.includes('spotify.com');
        const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
        const isSoundcloud = url.includes('soundcloud.com');

        if (isSpotify || isYoutube || isSoundcloud) {
            errorEl.style.display = 'none';
            return true;
        } else {
            errorEl.style.display = 'block';
            return false;
        }
    },

    closeAddModal() {
        document.getElementById('servicesModalOffszn').style.display = 'none';
    },

    showUpgradeModal() {
        document.getElementById('upgradeModalOffszn').style.display = 'block';
    },

    closeUpgradeModal() {
        document.getElementById('upgradeModalOffszn').style.display = 'none';
    },

    updatePlaylistCounter() {
        const val = document.getElementById('playlistTitle').value;
        const counter = document.getElementById('playlistTitleCounter');
        if (counter) counter.innerText = `${val.length}/30`;
    },

    setPlaylistCategory(cat, el) {
        document.getElementById('playlistCategory').value = cat;
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        
        // Show skeletons for a brief feel
        this.renderSkeletons();
        
        setTimeout(() => {
            this.renderBeatSelector(document.getElementById('beatSelectorSearch').value);
        }, 400); // Wait 400ms to mimic load
    },

    renderSkeletons() {
        const listEl = document.getElementById('beatSelectorList');
        if (!listEl) return;
        
        // Render 1 skeleton to minimize layout shift while still showing loading state
        listEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.02);">
                <div class="srv-skeleton" style="width: 50px; height: 50px; border-radius: 12px; flex-shrink: 0;"></div>
                <div style="display:flex; flex-direction:column; gap: 8px; width: 100%;">
                    <div class="srv-skeleton" style="width: 50%; height: 12px;"></div>
                    <div class="srv-skeleton" style="width: 30%; height: 10px;"></div>
                </div>
            </div>
        `;
    },

    async loadUserBeats() {
        const user = window.currentUserProfile;
        if (!user) return;

        // Render Initial Skeletons Behind the Scenes
        this.renderSkeletons();

        const { data, error } = await window.supabaseClient
            .from('products')
            .select('id, name, image_url, product_type, r2_version, storage_version')
            .eq('producer_id', user.id)
            .eq('visibility', 'public')
            .in('status', ['published', 'approved'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error loading user products:", error);
            const listEl = document.getElementById('beatSelectorList');
            if (listEl) listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #fa5252; font-size: 0.8rem;">Error al cargar</div>';
            return;
        }

        // PRE-AUTHORIZE ASSETS (Correct R2/Supabase handling)
        if (data && window.AuthUtils?.getAuthorizedUrl) {
            for (const b of data) {
                b._authorized_url = await window.AuthUtils.getAuthorizedUrl(
                    b.image_url, 
                    b.r2_version || b.storage_version, 
                    b.id
                );
            }
        }

        this.userBeats = data || [];
        this.renderBeatSelector();
    },

    renderBeatSelector(filter = '') {
        const listEl = document.getElementById('beatSelectorList');
        const search = filter.toLowerCase();
        const currentCat = document.getElementById('playlistCategory').value;
        const defaultFallback = '/images/portada-default.png';
        
        // STRICT CATEGORY FILTERING
        // Only show products matching the selected category (e.g., 'beat', 'preset')
        let filtered = this.userBeats.filter(b => {
            const matchesSearch = b.name.toLowerCase().includes(search);
            const isNotSelected = !this.selectedTracks.includes(String(b.id));
            const matchesCategory = (b.product_type || '').toLowerCase() === currentCat;
            
            return matchesSearch && isNotSelected && matchesCategory;
        });

        // Capping total items rendered to 10 (user constraint). 
        // max-height handles visual constraint to approx 2 items
        filtered = filtered.slice(0, 10);

        if (filtered.length === 0) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #444; font-size: 0.8rem;">${filter ? 'No hay resultados coincidiendo' : 'No hay productos en esta categoría'}</div>`;
            return;
        }

        listEl.innerHTML = filtered.map(b => `
            <div class="beat-selector-item" onclick="window.ServicesManager.addProductToStack('${b.id}'); event.stopPropagation();" style="display: flex; align-items: center; gap: 16px; padding: 16px 20px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.02); transition: all 0.25s ease;">
                <div style="position: relative; width: 56px; height: 56px; flex-shrink: 0;">
                    <img src="${b._authorized_url || b.image_url || defaultFallback}" onerror="this.src='${defaultFallback}'" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover; background: #111;">
                </div>
                <div style="display:flex; flex-direction:column; gap: 4px; overflow: hidden;">
                    <span style="font-size: 0.95rem; font-weight: 700; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${b.name}</span>
                </div>
                <div style="margin-left: auto; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; opacity: 0.3; transition: opacity 0.2s;">
                    <i class="bi bi-plus-lg" style="color: #fff; font-size: 1.1rem;"></i>
                </div>
            </div>
        `).join('');
    },

    filterSelector(val) {
        // Clear existing debounce timer
        clearTimeout(this._searchTimer);
        
        // Show skeletons immediately when typing
        this.renderSkeletons();
        
        // Wait briefly after user stops typing to filter the actual list
        this._searchTimer = setTimeout(() => {
            this.renderBeatSelector(val);
        }, 350);
    },

    addProductToStack(beatId) {
        // STRING CONVERSION FIX for BigInt IDs
        const bId = String(beatId);
        if (this.selectedTracks.includes(bId)) return;
        if (this.selectedTracks.length >= 10) return alert("Máximo 10 productos por playlist");

        const beat = this.userBeats.find(b => String(b.id) === bId);
        if (!beat) {
            console.warn("Product not found in local cache:", bId);
            return;
        }

        this.selectedTracks.push(bId);
        
        // Update Stack UI
        const stackEl = document.getElementById('playlistStack');
        const chip = document.createElement('div');
        const defaultFallback = '/images/portada-default.png';
        chip.className = 'stack-chip';
        chip.id = `stack-${bId}`;
        chip.innerHTML = `
            <img src="${beat._authorized_url || beat.image_url || defaultFallback}" onerror="this.src='${defaultFallback}'" alt="thumb">
            <span>${beat.name}</span>
            <div class="chip-remove" onclick="window.ServicesManager.removeFromStack('${bId}')">
                <i class="bi bi-x" style="font-size: 1.1rem;"></i>
            </div>
        `;
        
        stackEl.appendChild(chip);
        
        // Re-render selector to hide selected
        this.renderBeatSelector(document.getElementById('beatSelectorSearch').value);
    },

    removeFromStack(beatId) {
        const bId = String(beatId);
        this.selectedTracks = this.selectedTracks.filter(id => id !== bId);
        const item = document.getElementById(`stack-${bId}`);
        if (item) item.remove();
        
        // Re-render selector to show again
        this.renderBeatSelector(document.getElementById('beatSelectorSearch').value);
    },

    async saveItem() {
        const user = window.currentUserProfile;
        if (!user) return;

        const socials = user.socials || {};
        
        if (this.currentAction === 'service') {
            const category = document.getElementById('serviceCategory').value;
            const customTag = document.getElementById('serviceCustomTag').value;
            const title = document.getElementById('serviceTitle').value.trim();
            const descRaw = document.getElementById('serviceDesc').value.trim();
            const link = document.getElementById('serviceLink').value.trim();
            const priceValue = document.getElementById('servicePrice').value;
            const price = priceValue === "" ? null : parseFloat(priceValue);

            // RULE: Limit to 1 consecutive line break max
            const desc = descRaw.replace(/\n\s*\n/g, '\n\n');

            // Validations
            if (category === 'Otro' && !customTag) return alert("Por favor escribe tu etiqueta personalizada");
            if (!title) return alert("Por favor pon un título");
            if (title.length > 30) return alert("El título es demasiado largo (máx 30)");
            if (desc.length > 150) return alert("La descripción es demasiado larga (máx 150)");
            
            if (link && !this.validateLink(link)) {
                return alert("El link debe ser de Spotify, YouTube o SoundCloud");
            }

            if (price && (price < 0 || price > 1000)) {
                return alert("El precio debe estar entre 0 y 1000 USD");
            }

            socials.custom_services = socials.custom_services || [];
            if (socials.custom_services.length >= 6) {
                return alert("Límite de 6 servicios alcanzado.");
            }

            const slugGenerated = title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');

            const newService = {
                id: this.editingItemId || ('servicios_offszn_' + Date.now()),
                category: category === 'Otro' ? customTag : category,
                title,
                slug: slugGenerated,
                description: desc,
                link,
                price: price || null
            };

            if (this.editingItemId) {
                const idx = socials.custom_services.findIndex(s => s.id === this.editingItemId);
                if (idx !== -1) socials.custom_services[idx] = newService;
            } else {
                socials.custom_services.push(newService);
            }
        } else {
            const title = document.getElementById('playlistTitle').value;
            if (!title) return alert("Por favor pon un nombre a la playlist");

            const firstTrackId = this.selectedTracks[0];
            const firstTrack = this.userBeats.find(b => String(b.id) === String(firstTrackId));

            const newPlaylist = {
                id: this.editingItemId || ('playlist_offszn_' + Date.now()),
                title,
                category: document.getElementById('playlistCategory').value,
                cover_url: firstTrack ? firstTrack.image_url : '', 
                track_ids: [...this.selectedTracks]
            };

            socials.playlists = socials.playlists || [];
            
            if (this.editingItemId) {
                const idx = socials.playlists.findIndex(p => p.id === this.editingItemId);
                if (idx !== -1) socials.playlists[idx] = newPlaylist;
            } else {
                if (socials.playlists.length >= 5) {
                    return alert("Límite de 5 playlists alcanzado.");
                }
                socials.playlists.push(newPlaylist);
            }
        }

        // Save to Supabase
        const { error } = await window.supabaseClient
            .from('users')
            .update({ socials })
            .eq('id', user.id);

        if (error) {
            console.error("Error saving services:", error);
            alert("Error al guardar");
        } else {
            user.socials = socials; 
            this.closeAddModal();
            if (window.setActiveTab) window.setActiveTab('services');
        }
    },

    async openPlaylist(id) {
        console.log("Opening playlist:", id);
        
        const user = window.currentUserProfile;
        if (!user) {
            console.warn("No user profile found for playlist:", id);
            return;
        }

        const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});
        const playlists = socials.playlists || [];
        const playlist = playlists.find(p => p.id === id);

        if (!playlist || !playlist.track_ids || playlist.track_ids.length === 0) {
            console.warn("Playlist empty or not found:", id);
            alert("Esta playlist no tiene productos aún.");
            return;
        }

        try {
            // 1. Fetch full product data from Supabase
            // We use 'products' table and fetch all relevant metadata for StickyPlayer
            const { data: products, error } = await window.supabaseClient
                .from('products')
                .select('*, artist_users:producer_id(id, nickname, avatar_url, is_verified)')
                .in('id', playlist.track_ids)
                .eq('visibility', 'public')
                .in('status', ['published', 'approved']);

            if (error) throw error;

            if (!products || products.length === 0) {
                alert("No se pudieron cargar los productos de esta playlist.");
                return;
            }

            // 2. Map back to the original order defined in track_ids
            const trackMap = {};
            products.forEach(p => trackMap[String(p.id)] = p);
            
            const orderedTracks = playlist.track_ids
                .map(tId => trackMap[String(tId)])
                .filter(t => !!t);

            if (orderedTracks.length === 0) {
                alert("Los productos de esta playlist ya no están disponibles.");
                return;
            }

            // 3. Initialize StickyPlayer with the playlist context
            if (window.StickyPlayer) {
                // Update the global playlist in the player
                window.StickyPlayer.updatePlaylist(orderedTracks, playlist.title);
                
                // Play the first track
                window.StickyPlayer.play(orderedTracks[0]);
            } else {
                console.error("StickyPlayer not found in window object.");
                alert("El reproductor no está disponible en este momento.");
            }
        } catch (err) {
            console.error("Error opening playlist:", err);
            alert("Error al cargar la playlist. Por favor intenta de nuevo.");
        }
    },

    async editItem(type, id) {
        const user = window.currentUserProfile;
        if (!user) return;
        const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});

        this.editingItemId = id;
        
        // Find existing item
        let item = null;
        if (type === 'service') item = (socials.custom_services || []).find(s => s.id === id);
        else item = (socials.playlists || []).find(p => p.id === id);

        if (!item) return;

        // Open modal in edit mode (won't clear fields)
        this.openAddModal(type, true);

        // Pre-fill data
        if (type === 'service') {
            const standardCats = ['Mix y master', 'Producción completa', 'Mezcla de voces', 'Master', 'Remake de beats', 'Preset de voces', 'Plantilla de voces', 'Grabación de voces'];
            const isStandard = standardCats.includes(item.category);
            
            this.selectCategory(isStandard ? item.category : 'Otro');
            if (!isStandard) document.getElementById('serviceCustomTag').value = item.category || '';
            
            document.getElementById('serviceTitle').value = item.title || '';
            document.getElementById('serviceDesc').value = item.description || '';
            document.getElementById('serviceLink').value = item.link || '';
            document.getElementById('servicePrice').value = item.price || '';
            this.updateCounters();
        } else {
            document.getElementById('playlistTitle').value = item.title || '';
            this.updatePlaylistCounter();
            
            // Set category pill
            const cat = item.category || 'beat';
            document.getElementById('playlistCategory').value = cat;
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            const pill = document.querySelector(`.cat-pill[onclick*="'${cat}'"]`);
            if (pill) pill.classList.add('active');

            // Wait for user beats to load if not already
            if (this.userBeats.length === 0) await this.loadUserBeats();
            
            // Populate tracks
            this.selectedTracks = [];
            document.getElementById('playlistStack').innerHTML = '';
            document.getElementById('beatSelectorSearch').value = '';
            
            if (item.track_ids && item.track_ids.length > 0) {
                // Must add them manually using internal logic to render properly
                item.track_ids.forEach(tId => this.addProductToStack(tId));
            }
            
            this.renderBeatSelector(); // Final render refresh on the remaining list
        }
    },

    async deleteItem(type, id) {
        if (!confirm(`¿Estás seguro de que deseas eliminar est${type === 'playlist' ? 'a playlist' : 'e servicio'}? No podrás recuperarlo.`)) return;

        const user = window.currentUserProfile;
        if (!user) return;
        const socials = typeof user.socials === 'string' ? JSON.parse(user.socials) : (user.socials || {});

        if (type === 'playlist') {
            socials.playlists = (socials.playlists || []).filter(p => p.id !== id);
        } else {
            socials.custom_services = (socials.custom_services || []).filter(s => s.id !== id);
        }

        const { error } = await window.supabaseClient.from('users').update({ socials }).eq('id', user.id);
        
        if (error) {
            console.error(error);
            alert("Error al eliminar");
        } else {
            user.socials = socials;
            if (window.setActiveTab) window.setActiveTab('services'); // Refresh view
        }
    }
};

window.ServicesManager.init();
