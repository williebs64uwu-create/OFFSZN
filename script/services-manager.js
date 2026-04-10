/**
 * OFFSZN Services Manager
 * Handles dynamic services and playlists for producer profiles.
 */

window.ServicesManager = {
    currentAction: null, // 'service' or 'playlist'

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
            </style>
            <div id="servicesModalOffszn" class="p-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10000; backdrop-filter: blur(15px); color: #fff; font-family: 'Plus Jakarta Sans', sans-serif;">
                <div class="p-modal-content" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; background: #080808; border: 1px solid #1a1a1a; border-radius: 24px; overflow: hidden; box-shadow: 0 50px 120px rgba(0,0,0,0.95);">
                    <div class="p-modal-header" style="padding: 24px 32px; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; align-items: center;">
                        <h3 id="servicesModalTitle" style="margin: 0; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.3px;">Añadir Servicio</h3>
                        <button onclick="window.ServicesManager.closeAddModal()" style="background: rgba(255,255,255,0.04); border: none; color: #666; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; display:flex; align-items:center; justify-content:center; cursor: pointer; transition: all 0.2s;">&times;</button>
                    </div>
                    <div class="p-modal-main-view" style="padding: 32px; display: flex; flex-direction: column; max-height: 75vh; overflow-y: auto;">
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
                            <label class="offszn-label">Nombre de la Playlist</label>
                            <input type="text" id="playlistTitle" class="offszn-input-field" placeholder="Mis Mejores Beats" style="margin-bottom: 20px;">
                            <p style="font-size: 0.8rem; color: #666; line-height: 1.4;">Luego podrás añadir tus beats de OFFSZN a esta lista directamente.</p>
                        </div>

                        <button onclick="window.ServicesManager.saveItem()" style="width: 100%; padding: 18px; margin-top: 10px; background: #fff; color: #000; border: none; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-size: 0.95rem;">Guardar Servicio</button>
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

    openAddModal(type) {
        this.currentAction = type;
        const modal = document.getElementById('servicesModalOffszn');
        const title = document.getElementById('servicesModalTitle');
        const serviceFields = document.getElementById('serviceFields');
        const playlistFields = document.getElementById('playlistFields');

        // Reset fields
        if (type === 'service') {
            title.innerText = 'Añadir Servicio';
            serviceFields.style.display = 'block';
            playlistFields.style.display = 'none';
            
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
            this.setupListeners();
        } else {
            title.innerText = 'Nueva Playlist (Estilo Spotify)';
            serviceFields.style.display = 'none';
            playlistFields.style.display = 'block';
            document.getElementById('playlistTitle').value = '';
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
            if (socials.custom_services.length >= 5) {
                return alert("Límite de 5 servicios alcanzado.");
            }

            const newService = {
                id: 'servicios_offszn_' + Date.now(),
                category: category === 'Otro' ? customTag : category,
                title,
                description: desc,
                link,
                price: price || null
            };

            socials.custom_services.push(newService);
        } else {
            const title = document.getElementById('playlistTitle').value;
            if (!title) return alert("Por favor pon un nombre a la playlist");

            const newPlaylist = {
                id: 'playlist_offszn_' + Date.now(),
                title,
                cover_url: '', 
                track_ids: []
            };

            socials.playlists = socials.playlists || [];
            if (socials.playlists.length >= 5) {
                return alert("Límite de 5 playlists alcanzado.");
            }
            socials.playlists.push(newPlaylist);
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

    openPlaylist(id) {
        console.log("Opening playlist:", id);
        alert("Función de reproducción de playlist próximamente...");
    }
};

window.ServicesManager.init();
