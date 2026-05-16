// ===== CHAT ENGINE - COMPLETE REWRITE =====
// Use the global client initialized by auth-utils.js
const supabase = window.supabaseClient;

// 🛡️ SECURITY UTILITY: Anti-XSS Sanitizer
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Safety check (Non-blocking log, verified in init)
if (!supabase && window.location.pathname.includes('chat')) {
    console.warn("Chat Engine: Global Supabase not found yet. It should be initialized by auth-utils.js.");
}

let currentUser = null;
let currentConversationId = null;
let emojiPicker = null;
let isInitialized = false;
let replyToId = null; // State for current reply
let _loadedPrincipal = false;
let _loadedGroups = false;
let _groupsCache = [];
let _isInitialLoading = true; // V14: Ironclad guard for skeletons

// ===== GLOBAL EXPORTS (For HTML onclicks) =====
window.onReplyClick = onReplyClick;
window.cancelReply = cancelReply;
window.onReactClick = onReactClick;
window.submitReaction = submitReaction;
window.removeReaction = removeReaction;
window.scrollToMessage = scrollToMessage;
window.openNewMessageModal = openNewMessageModal;
window.closeNewMessageModal = closeNewMessageModal;
window.startChatFromModal = startChatFromModal;
window.toggleMessageMenu = toggleMessageMenu;
window.copyMessageText = copyMessageText;
window.backToSidebar = backToSidebar;
window.toggleMobileView = toggleMobileView;
window.openGroupModal = openGroupModal;
window.closeGroupModal = closeGroupModal;

// ===== NAVIGATION HELPERS =====
function toggleMobileView(showChat) {
    const root = document.getElementById('chatSystemRoot');
    if (!root) return;
    if (showChat) {
        root.classList.add('show-chat');
    } else {
        root.classList.remove('show-chat');
    }
}

function backToSidebar() {
    toggleMobileView(false);
}

// ===== INITIALIZATION =====
// 🛡️ SPA SAFEGUARD
function isChatPage() {
    return !!document.getElementById('chatSystemRoot');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!isChatPage()) return; // 🛑 Stop if not on chat page
    initChat();
});

// SPA Navigation Listener
document.addEventListener('offszn:page-changed', (e) => {
    if (isChatPage()) {
        initChat();
    }
});

async function initChat() {
    if (isInitialized) return;
    isInitialized = true;
    _isInitialLoading = true; // Ensure guard is set

    // console.log("💬 Chat Engine Initialized");
    // initUI(); // Assuming initUI() is defined elsewhere or will be added.

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    currentUser = session.user;

    // Show UI (Skeletons visible by default in HTML)
    // Replace HTML skeletons with 50 JS-generated ones for full coverage
    const skelDiv = document.getElementById('chatSidebarSkeletons');
    if (skelDiv) skelDiv.innerHTML = _renderChatSkeletons();

    // Setup everything
    setupEventListeners();

    // CHAIN LOAD: User -> then (Conversations + Realtime)
    // or PARALLEL: User + Conversations -> then Reveal

    const p1 = loadUserProfile();
    const p2 = loadConversations({ keepSkeletons: true });
    const p3 = new Promise(resolve => setTimeout(resolve, 2000)); // Mandatory ~2s skeleton display

    // --- INSTANT PRE-FILL TRICK ---
    // Handle ?user=nickname parameter ASAP
    const urlParams = new URLSearchParams(window.location.search);
    const targetNickname = urlParams.get('user');
    const targetUserId = urlParams.get('to');
    const initialMsg = urlParams.get('msg') || urlParams.get('text');
    const directConvId = urlParams.get('convId');

    if (targetNickname || targetUserId) {
        // Find target user but don't AWAIT yet for the UI reveal
        let query = supabase.from('users').select('id, nickname, avatar_url');
        
        if (targetNickname) {
            query = query.eq('nickname', targetNickname).single();
        } else {
            query = query.eq('id', targetUserId).single();
        }

        query.then(async ({ data: targetUser, error }) => {
            if (targetUser && !error) {
                await startNewChat(targetUser);
                if (initialMsg) {
                    const input = document.getElementById('messageInput');
                    if (input) {
                        input.value = initialMsg;
                        adjustInputHeight(input);
                        input.focus();
                    }
                }
            }
        });
    }

    if (directConvId) {
        // Handle direct conversation link (DMs or Groups) ASAP
        supabase
            .from('conversations')
            .select('id, is_group, group_name, group_avatar_url')
            .eq('id', directConvId)
            .single()
            .then(async ({ data: conv, error }) => {
                if (conv && !error) {
                    if (conv.is_group) {
                        openChat(conv.id, conv.group_name || 'Grupo', conv.group_avatar_url, null, true);
                    } else {
                        // It's a DM, find the other participant
                        const { data: participation } = await supabase
                            .from('conversation_participants')
                            .select('user_id')
                            .eq('conversation_id', directConvId)
                            .neq('user_id', currentUser.id)
                            .maybeSingle();

                        if (participation) {
                            const { data: targetUser } = await supabase
                                .from('users')
                                .select('id, nickname, avatar_url')
                                .eq('id', participation.user_id)
                                .single();

                            if (targetUser) {
                                openChat(directConvId, targetUser.nickname, targetUser.avatar_url, targetUser.id, false);
                            }
                        }
                    }
                }
            });
    }

    await Promise.all([p1, p2, p3]);

    // SYNC REVEAL: All data is ready
    finalizeGlobalLoading();

    // FORCE INDICATOR NOW — respect whichever tab is active
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) _updateTabIndicator(activeTab);

    setupRealtime();


    /* REMOVED: Don't restore last chat automatically as per user request
    if (lastConvId) {
        const item = document.querySelector(`.chat-item[data-id="${lastConvId}"]`);
        if (item) item.click();
    }
    */
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Message input - Enter key
    // Message input - Enter key & Auto-height
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', () => {
            adjustInputHeight(input);
        });
    }

    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Search (sidebar only - scoped to avoid conflict with group modal search)
    const searchInput = document.querySelector('.search-bar-container .search-input-wrapper input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => handleUserSearch(e.target.value), 300);
        });
    }

    // Tab buttons
    const tabPrincipal = document.getElementById('tabPrincipal');
    const tabGrupos = document.getElementById('tabGrupos');
    const searchInputEl = document.querySelector('.search-bar-container .search-input-wrapper input');

    function deactivateAllTabs() {
        [tabPrincipal, tabGrupos].forEach(t => { if (t) t.classList.remove('active'); });
    }

    if (tabPrincipal) {
        // Initial call to set indicator position ASAP
        setTimeout(() => _updateTabIndicator(tabPrincipal), 100);

        tabPrincipal.onclick = () => {
            if (tabPrincipal.classList.contains('active')) return;
            if (isEditMode) toggleEditMode();
            deactivateAllTabs();
            tabPrincipal.classList.add('active');
            _updateTabIndicator(tabPrincipal);
            if (searchInputEl) {
                searchInputEl.disabled = false;
                searchInputEl.parentElement.style.opacity = '1';
                searchInputEl.placeholder = 'Buscar';
            }
            // Ensure conversationsList is visible and skeletons are hidden
            const convList = document.getElementById('conversationsList');
            const skelDiv = document.getElementById('chatSidebarSkeletons');
            if (convList) { convList.style.display = ''; convList.style.opacity = '1'; }
            if (skelDiv) skelDiv.style.display = 'none';
            // INSTANT: Render from cache (data already loaded), no Supabase re-fetch
            loadConversations({ skipSkeletons: true });
        };
    }
    // Solicitudes tab logic removed
    if (tabGrupos) {
        tabGrupos.onclick = () => {
            if (tabGrupos.classList.contains('active')) return;
            if (isEditMode) toggleEditMode();
            deactivateAllTabs();
            tabGrupos.classList.add('active');
            _updateTabIndicator(tabGrupos);
            if (searchInputEl) {
                searchInputEl.disabled = true;
                searchInputEl.parentElement.style.opacity = '0.5';
                searchInputEl.placeholder = 'Solo Principal';
                searchInputEl.value = '';
            }
            // Unified load for groups
            loadConversations({ skipSkeletons: true });
        };
    }

    // Filter button
    const filterBtn = document.getElementById('btnFilterChats');
    if (filterBtn) {
        filterBtn.onclick = (e) => {
            e.stopPropagation();
            // Optional: Toggle active state if it becomes a tab
            // For now just alert or toggle a visual state
            filterBtn.classList.toggle('active');
        };
    }

    // New Chat button (+)
    const plusBtn = document.getElementById('btnNewMessage');
    if (plusBtn) {
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openNewMessageModal();
        });
    }

    // Emoji picker
    setupEmojiPicker();

    // Event Listeners setup
}

let isEditMode = false;
function toggleEditMode() {
    isEditMode = !isEditMode;
    const items = document.querySelectorAll('.chat-item');
    items.forEach(item => {
        let delBtn = item.querySelector('.delete-chat-btn');
        const dateEl = item.querySelector('.chat-preview-date');

        if (isEditMode) {
            // Hide the time with a fade
            if (dateEl) {
                dateEl.style.transition = 'opacity 0.2s ease';
                dateEl.style.opacity = '0';
                dateEl.style.pointerEvents = 'none';
            }
            if (!delBtn) {
                delBtn = document.createElement('button');
                delBtn.className = 'delete-chat-btn';
                delBtn.innerHTML = '<i class="bi bi-trash"></i>';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    const convId = item.getAttribute('data-id');
                    if (confirm('¿Eliminar esta conversación?')) {
                        deleteConversation(convId);
                    }
                };
                item.appendChild(delBtn);
            }
            delBtn.style.display = 'flex';
        } else {
            // Restore the time
            if (dateEl) {
                dateEl.style.transition = 'opacity 0.2s ease';
                dateEl.style.opacity = '1';
                dateEl.style.pointerEvents = '';
            }
            if (delBtn) delBtn.style.display = 'none';
        }
    });
}

// Solicitudes logic removed

// showGrupos refactored to be a simple trigger for loadConversations
async function showGrupos() {
    loadConversations({ skipSkeletons: true });
}

function _updateTabIndicator(activeTab) {
    const indicator = document.getElementById('tabIndicator');
    if (!indicator || !activeTab) return;

    // Use offsetLeft and offsetWidth for smooth sliding
    indicator.style.width = `${activeTab.offsetWidth}px`;
    indicator.style.left = `${activeTab.offsetLeft}px`;

    // Re-enable transition after first paint (was disabled inline for instant load)
    requestAnimationFrame(() => {
        indicator.style.transition = '';
    });
}

function _renderChatSkeletons() {
    let html = '';
    for (let i = 0; i < 50; i++) {
        html += `
            <div class="skeleton-chat-item skeleton-pulse" style="padding: 12px 20px;">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-line name" style="width: 40%"></div>
                    <div class="skeleton-line preview" style="width: 70%"></div>
                </div>
            </div>
        `;
    }
    return html;
}

function _renderGruposSkeletons() {
    let html = '';
    for (let i = 0; i < 15; i++) {
        html += `
            <div class="skeleton-chat-item skeleton-pulse" style="padding: 12px 20px;">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                    <div class="skeleton-line name" style="width: 45%"></div>
                    <div class="skeleton-line preview" style="width: 30%"></div>
                </div>
            </div>
        `;
    }
    return html;
}

function _renderMessageSkeletons() {
    let html = '';
    for (let i = 0; i < 6; i++) {
        const type = i % 2 === 0 ? 'received' : 'sent';
        const size = i % 3 === 0 ? 'sm' : (i % 3 === 1 ? 'lg' : '');
        html += `
            <div class="skeleton-bubble ${type} ${size ? 'skeleton-bubble-' + size : ''} skeleton-pulse" 
                 style="margin-bottom: 12px; height: 40px; border-radius: 20px;"></div>
        `;
    }
    return `
        <div class="skeleton-bubbles-container">
            ${html}
        </div>
    `;
}

function setupEmojiPicker() {
    const emojiBtn = document.getElementById('emojiBtn');
    const input = document.getElementById('messageInput');

    if (!emojiBtn || !input) return;

    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiList();
    });
}

function toggleEmojiList() {
    let picker = document.getElementById('customEmojiPicker');
    if (picker) {
        picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
        return;
    }

    picker = document.createElement('div');
    picker.id = 'customEmojiPicker';
    picker.className = 'custom-emoji-picker';

    const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾'];

    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.onclick = () => {
            const input = document.getElementById('messageInput');
            input.value += emoji;
            input.focus();
        };
        picker.appendChild(span);
    });

    const inputArea = document.querySelector('.input-container');
    inputArea.style.position = 'relative';
    picker.style.position = 'absolute';
    picker.style.bottom = '100%';
    picker.style.left = '0';
    picker.style.marginBottom = '10px';

    inputArea.appendChild(picker);

    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target.id !== 'emojiBtn') {
            picker.style.display = 'none';
        }
    });
}

// ===== SEARCH USERS =====
async function handleUserSearch(query) {
    const listContainer = document.getElementById('conversationsList');

    // Block search if not on Principal tab
    const tabPrincipal = document.getElementById('tabPrincipal');
    if (!tabPrincipal || !tabPrincipal.classList.contains('active')) {
        return; // Do nothing if on Solicitudes
    }

    if (!query) {
        loadConversations(); // Safe to reload because we checked tab
        return;
    }

    // listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Buscando...</div>';

    const { data: profiles, error } = await supabase
        .from('users')
        .select('id, nickname, avatar_url')
        .ilike('nickname', `%${query}%`)
        .neq('id', currentUser.id)
        .limit(10);

    if (error || !profiles || profiles.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No se encontraron usuarios.</div>';
        return;
    }

    listContainer.innerHTML = '';
    profiles.forEach(user => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.onclick = () => startNewChat(user);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'chat-name';
        nameDiv.textContent = user.nickname;

        const previewDiv = document.createElement('div');
        previewDiv.className = 'chat-preview';
        previewDiv.style.color = '#8b5cf6';
        previewDiv.textContent = 'Click para iniciar chat';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'chat-info';
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(previewDiv);

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-avatar';
        avatarDiv.innerHTML = renderAvatar(user.avatar_url, user.nickname);

        div.appendChild(avatarDiv);
        div.appendChild(infoDiv);
        listContainer.appendChild(div);
    });
}

// ===== GROUP CHAT LOGIC (Fully JS-DOM isolated) =====
let selectedGroupUsers = [];
const MAX_GROUP_MEMBERS = 9;
let grpDebounceTimer = null;

function openGroupModal() {
    selectedGroupUsers = [];

    // Remove any existing modal first
    const existing = document.getElementById('grp_overlay');
    if (existing) existing.remove();

    // BUILD MODAL DOM FROM SCRATCH
    const overlay = document.createElement('div');
    overlay.id = 'grp_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);animation:fadeInOverlay 0.2s ease;';

    const panel = document.createElement('div');
    panel.id = 'grp_panel';
    panel.style.cssText = 'background:#111;border-radius:16px;border:1px solid #222;width:95%;max-width:420px;max-height:90vh;display:flex;flex-direction:column;animation:slideUpModal 0.25s ease;position:relative;overflow:hidden;';

    const style = document.createElement('style');
    style.innerHTML = `
        .grp-float-input {
            width: 100%; padding: 14px 12px; border: 1px solid #333; border-radius: 8px; background: transparent; color: #fff; font-size: 0.95rem; box-sizing: border-box; outline: none; transition: border-color 0.3s;
        }
        .grp-float-input:focus { border-color: #fff; }
        .grp-float-label {
            position: absolute; left: 12px; top: 14px; padding: 0 4px; font-size: 0.95rem; color: #888; background: #111; pointer-events: none; transition: 0.25s ease all;
        }
        .grp-float-input:focus ~ .grp-float-label,
        .grp-float-input:not(:placeholder-shown) ~ .grp-float-label {
            top: -8px; font-size: 0.75rem; color: #fff;
        }
        .grp-float-input:not(:focus):not(:placeholder-shown) ~ .grp-float-label {
            color: #888;
        }
        .grp-float-counter {
            position: absolute; right: 12px; top: -8px; padding: 0 4px; font-size: 0.75rem; color: #888; background: #111; pointer-events: none; opacity: 0; transition: opacity 0.25s;
        }
        .grp-float-input:focus ~ .grp-float-counter,
        .grp-float-input:not(:placeholder-shown) ~ .grp-float-counter {
            opacity: 1;
        }
        .grp-skeleton-pulse {
            animation: grpPulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes grpPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .4; }
        }
    `;
    overlay.appendChild(style);

    panel.innerHTML = `
        <!-- STEP 1: Details & Participants -->
        <div id="grp_step1" style="display:flex; flex-direction:column; height:100%; padding:24px;">
            <div style="display:flex;align-items:center;margin-bottom:20px;width:100%;">
                <button id="grp_closeBtn" style="background:none;border:none;color:#fff;cursor:pointer;padding:0;display:flex;align-items:center;">
                    <i class="bi bi-arrow-left-short" style="font-size: 2rem; color: #a855f7;"></i>
                </button>
                <h3 style="margin:0;font-size:1.1rem;color:#fff;flex:1;text-align:center;margin-right:32px;">Nuevo Grupo</h3>
                <div style="flex:0 0 32px"></div> <!-- Spacer -->
            </div>
            
            <div style="position:relative; margin-bottom: 24px; margin-top: 8px;">
                <input type="text" id="grp_nameInput" placeholder=" " maxlength="40" class="grp-float-input">
                <label class="grp-float-label">Nombre del Grupo <span style="color:#999">*</span></label>
                <div id="grp_nameCounter" class="grp-float-counter">0/40</div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;">
                <label style="font-size:0.8rem;color:#888;margin:0;">Participantes</label>
                <span id="grp_counter" style="font-size:0.75rem;font-weight:600;color:#999;">0/9</span>
            </div>
            
            <div id="grp_selectedUsers" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;"></div>

            <div style="margin-bottom:16px;background:transparent;border:1px solid #333;border-radius:8px;display:flex;align-items:center;padding:10px 14px;gap:8px;transition:border-color 0.2s;">
                <i class="bi bi-search" style="color:#555;font-size:0.9rem;"></i>
                <input type="text" id="grp_searchInput" placeholder="Buscar usuarios..."
                    style="background:none;border:none;color:#fff;font-size:0.9rem;width:100%;outline:none;">
            </div>
            
            <div id="grp_usersList" class="chat-custom-scrollbar" style="flex:1;min-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:20px;padding-right:4px;">
                <!-- Content here will be populated dynamically -->
            </div>
            
            <button id="grp_nextBtn" style="width:100%;border-radius:8px;padding:14px;font-weight:600;font-size:0.95rem;background:#fff;color:#000;border:none;cursor:pointer;opacity:0.5;pointer-events:none;transition: all 0.2s;">
                SIGUIENTE
            </button>
        </div>

        <!-- STEP 2: Avatar Setup -->
        <div id="grp_step2" class="grp-step-2" style="height:100%; padding:24px; display:none; flex-direction:column;">
            <div style="display:flex;align-items:center;margin-bottom:40px;width:100%;">
                <button id="grp_backBtn" style="background:none;border:none;color:#fff;cursor:pointer;padding:0;display:flex;align-items:center;">
                    <i class="bi bi-arrow-left-short" style="font-size: 2rem; color: #a855f7;"></i>
                </button>
                <h3 style="margin:0;font-size:1.1rem;color:#fff;flex:1;text-align:center;margin-right:32px;">Foto del Grupo</h3>
                <div style="flex:0 0 32px"></div> <!-- Spacer -->
            </div>

            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <div id="grp_avatarPreview" class="grp-avatar-preview">
                    <i class="bi bi-camera-fill" style="font-size:2.5rem; color:#444;"></i>
                </div>
                
                <p style="color:#888; font-size:0.9rem; margin-bottom:32px; max-width:250px; line-height:1.4;">
                    Elige una foto para tu grupo. También puedes subir un <b>GIF (PRO)</b>.
                </p>

                <input type="file" id="grp_fileInput" accept="image/*,.gif" style="display:none;">
                <button id="grp_uploadBtn" style="background:#1a1a1a; border:1px solid #333; color:#fff; padding:10px 24px; border-radius:30px; font-size:0.9rem; cursor:pointer; margin-bottom:12px; transition:all 0.2s;">
                    Subir Imagen
                </button>
            </div>

            <button id="grp_finalBtn" style="width:100%;border-radius:8px;padding:14px;font-weight:600;font-size:0.95rem;background:#fff;color:#000;border:none;cursor:pointer;transition: all 0.2s;">
                CREAR GRUPO
            </button>
        </div>
    `;


    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // EVENTS — all scoped to this modal, no external interference
    // Close on overlay background click (NOT on panel)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGroupModal();
    });

    // Stop all clicks inside panel from bubbling to overlay or document
    panel.addEventListener('click', (e) => e.stopPropagation());

    // Close button
    document.getElementById('grp_closeBtn').onclick = () => closeGroupModal();

    // Name input — update submit state and counter
    document.getElementById('grp_nameInput').oninput = (e) => {
        const counter = document.getElementById('grp_nameCounter');
        if (counter) counter.innerText = `${e.target.value.length}/40`;
        _grpUpdateSubmit();
    };

    // Search input — debounced
    document.getElementById('grp_searchInput').oninput = (e) => {
        const val = e.target.value;
        const listItems = document.getElementById('grp_usersList');
        if (listItems) listItems.innerHTML = _grpGetSkeletonHtml();

        clearTimeout(grpDebounceTimer);
        grpDebounceTimer = setTimeout(() => _grpSearch(val), 400);
    };

    // Step navigation
    document.getElementById('grp_nextBtn').onclick = () => {
        document.getElementById('grp_step1').style.display = 'none';
        document.getElementById('grp_step2').style.display = 'flex';
    };

    document.getElementById('grp_backBtn').onclick = () => {
        document.getElementById('grp_step1').style.display = 'flex';
        document.getElementById('grp_step2').style.display = 'none';
    };

    // Avatar selection
    const fileInput = document.getElementById('grp_fileInput');
    const avatarPreview = document.getElementById('grp_avatarPreview');
    const uploadBtn = document.getElementById('grp_uploadBtn');

    uploadBtn.onclick = () => fileInput.click();
    avatarPreview.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            window.selectedGroupAvatarBase64 = event.target.result;
            const isGif = file.type === 'image/gif';

            avatarPreview.innerHTML = `<img id="grp_img_el" src="${event.target.result}" style="width:100%;height:100%;object-fit:cover;cursor:move;user-select:none;touch-action:none;">`;
            avatarPreview.style.borderStyle = 'solid';
            avatarPreview.style.borderColor = '#fff'; // White border as requested

            if (!isGif) {
                // Full 2D Panning + Scroll wheel support
                const img = document.getElementById('grp_img_el');
                let isDragging = false;
                let startX = 0, startY = 0;
                let currentX = 0, currentY = 0;
                let offsetX = 0, offsetY = 0;

                function applyTransform() {
                    img.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                    window.grp_offset_x = offsetX;
                    window.grp_offset_y = offsetY;
                }

                // Mouse drag
                img.onmousedown = (e) => {
                    e.preventDefault();
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    currentX = offsetX;
                    currentY = offsetY;
                };
                document.addEventListener('mouseup', () => isDragging = false);
                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    offsetX = currentX + (e.clientX - startX);
                    offsetY = currentY + (e.clientY - startY);
                    applyTransform();
                });

                // Scroll wheel for vertical repositioning
                avatarPreview.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    offsetY -= e.deltaY * 0.5;
                    applyTransform();
                }, { passive: false });

                // Touch support for mobile
                img.ontouchstart = (e) => {
                    isDragging = true;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    currentX = offsetX;
                    currentY = offsetY;
                };
                img.ontouchend = () => isDragging = false;
                img.ontouchmove = (e) => {
                    if (!isDragging) return;
                    offsetX = currentX + (e.touches[0].clientX - startX);
                    offsetY = currentY + (e.touches[0].clientY - startY);
                    applyTransform();
                };
            }
        };
        reader.readAsDataURL(file);
    };

    // Submit button
    document.getElementById('grp_finalBtn').onclick = () => _grpCreateChat();

    // Initial state
    const list = document.getElementById('grp_usersList');
    if (list) list.innerHTML = _grpGetSkeletonHtml();
    _grpUpdateSelectedChips();
    _grpSearch('');

    // Focus name input
    setTimeout(() => {
        const ni = document.getElementById('grp_nameInput');
        if (ni) ni.focus();
    }, 50);
}

function closeGroupModal() {
    const overlay = document.getElementById('grp_overlay');
    if (overlay) overlay.remove(); // Completely remove from DOM
}

function _grpGetSkeletonHtml() {
    let html = '';
    for (let i = 0; i < 10; i++) {
        html += `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;opacity:0.7;">
            <div class="grp-skeleton-pulse" style="width:36px;height:36px;border-radius:50%;background:#222;flex-shrink:0;"></div>
            <div class="grp-skeleton-pulse" style="flex:1;">
                <div style="height:12px;width:60%;background:#222;border-radius:4px;margin-bottom:6px;"></div>
                <div style="height:10px;width:40%;background:#222;border-radius:4px;"></div>
            </div>
            <div class="grp-skeleton-pulse" style="width:20px;height:20px;border-radius:50%;background:#222;flex-shrink:0;"></div>
        </div>`;
    }
    return html;
}

// Internal: search users
async function _grpSearch(query) {
    const list = document.getElementById('grp_usersList');
    if (!list) return;

    if (!query || query.trim().length < 2) {
        list.innerHTML = _grpGetSkeletonHtml();

        // Fetch recent DMs
        const { data: recent, error: recentErr } = await supabase
            .from('conversations')
            .select(`
                id,
                is_group,
                updated_at,
                conversation_participants!inner(user_id),
                participants:conversation_participants(
                    user:users!user_id(id, nickname, avatar_url, first_name, last_name)
                )
            `)
            .eq('is_group', false)
            .eq('conversation_participants.user_id', currentUser.id)
            .order('updated_at', { ascending: false })
            .limit(10);

        if (recentErr || !recent || recent.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:0.85rem;">Busca usuarios para agregarlos.</div>';
            return;
        }

        // Extract the other user from each DM
        const profiles = recent.map(conv => {
            const otherPart = conv.participants.find(p => p.user && p.user.id !== currentUser.id);
            return otherPart ? otherPart.user : null;
        }).filter(u => u !== null);

        // Deduplicate
        const uniqueProfiles = [];
        const seenIds = new Set();
        for (const p of profiles) {
            if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                uniqueProfiles.push(p);
            }
        }

        if (uniqueProfiles.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:0.85rem;">Busca usuarios para agregarlos.</div>';
            return;
        }

        _grpRenderUserList(uniqueProfiles, list);
        return;
    }
    list.innerHTML = _grpGetSkeletonHtml();

    const { data: profiles, error } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, first_name, last_name')
        .ilike('nickname', `%${query}%`)
        .neq('id', currentUser.id)
        .limit(15);

    if (error || !profiles || profiles.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#555;padding:20px;font-size:0.85rem;">No se encontraron usuarios.</div>';
        return;
    }

    _grpRenderUserList(profiles, list);
}

function _grpRenderUserList(profiles, list) {
    list.innerHTML = '';
    profiles.forEach(user => {
        const isSelected = selectedGroupUsers.some(u => u.id === user.id);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background 0.15s;';
        row.onmouseenter = () => row.style.background = '#1a1a1a';
        row.onmouseleave = () => row.style.background = 'transparent';

        row.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;">
                ${renderAvatar(user.avatar_url, user.nickname)}
            </div>
            <span style="flex:1;font-size:0.9rem;color:#fff;">${escapeHTML(user.nickname)}</span>
            <i data-uid="${user.id}" class="bi ${isSelected ? 'bi-check-circle-fill' : 'bi-circle'}" style="font-size:1.15rem;color:${isSelected ? '#fff' : '#444'};transition:color 0.2s;"></i>
        `;

        row.onclick = (e) => {
            e.stopPropagation();
            const icon = row.querySelector('i');
            const idx = selectedGroupUsers.findIndex(u => u.id === user.id);

            if (idx >= 0) {
                selectedGroupUsers.splice(idx, 1);
                icon.className = 'bi bi-circle';
                icon.style.color = '#444';
            } else {
                if (selectedGroupUsers.length >= MAX_GROUP_MEMBERS) {
                    const counter = document.getElementById('grp_counter');
                    if (counter) {
                        counter.style.color = '#ef4444';
                        setTimeout(() => counter.style.color = '#999', 800);
                    }
                    return;
                }
                selectedGroupUsers.push(user);
                icon.className = 'bi bi-check-circle-fill';
                icon.style.color = '#fff';
            }
            _grpUpdateCounter();
            _grpUpdateSubmit();
            _grpUpdateSelectedChips();
        };

        list.appendChild(row);
    });
}

function _grpUpdateSelectedChips() {
    const container = document.getElementById('grp_selectedUsers');
    if (!container) return;

    container.innerHTML = '';
    if (selectedGroupUsers.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';
    selectedGroupUsers.forEach(user => {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:flex;align-items:center;gap:6px;background:#1a1a1a;border:1px solid #333;padding:4px;padding-right:8px;border-radius:20px;cursor:pointer;animation:fadeInOverlay 0.2s ease;';
        chip.innerHTML = `
            <div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;font-size:0.75rem;">
                ${renderAvatar(user.avatar_url, user.nickname)}
            </div>
            <span style="font-size:0.8rem;color:#ccc;">${escapeHTML(user.nickname)}</span>
            <i class="bi bi-x-circle-fill" style="color:#666;font-size:0.8rem;transition:color 0.15s;" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#666'"></i>
        `;

        chip.onclick = (e) => {
            e.stopPropagation();
            const idx = selectedGroupUsers.findIndex(u => u.id === user.id);
            if (idx >= 0) {
                selectedGroupUsers.splice(idx, 1);
                _grpUpdateCounter();
                _grpUpdateSubmit();
                _grpUpdateSelectedChips();
                // Toggle the circle if visible in the list without re-rendering
                const listIcon = document.querySelector(`#grp_usersList i[data-uid="${user.id}"]`);
                if (listIcon) {
                    listIcon.className = 'bi bi-circle';
                    listIcon.style.color = '#444';
                }
            }
        };

        container.appendChild(chip);
    });
}

function _grpUpdateCounter() {
    const counter = document.getElementById('grp_counter');
    if (counter) counter.innerText = `${selectedGroupUsers.length} / ${MAX_GROUP_MEMBERS}`;
}

function _grpUpdateSubmit() {
    const btn = document.getElementById('grp_nextBtn');
    if (!btn) return;
    const hasMembers = selectedGroupUsers.length > 0;
    btn.style.opacity = hasMembers ? '1' : '0.5';
    btn.style.pointerEvents = hasMembers ? 'auto' : 'none';
}

// Helper to crop the group avatar using canvas to preserve pan/scroll
async function _cropGroupAvatar() {
    const img = document.getElementById('grp_img_el');
    if (!img) return window.selectedGroupAvatarBase64;

    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const size = 160; // Size of the preview container
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw circles for clip
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        // Calculate actual dimensions to maintain aspect ratio and fill
        const imgAspect = img.naturalWidth / img.naturalHeight;
        let drawW, drawH;
        if (imgAspect > 1) {
            drawH = size;
            drawW = size * imgAspect;
        } else {
            drawW = size;
            drawH = size / imgAspect;
        }

        // Apply the user's offsets
        const x = (window.grp_offset_x || 0);
        const y = (window.grp_offset_y || 0);

        // Center then offset
        ctx.drawImage(img, (size - drawW) / 2 + x, (size - drawH) / 2 + y, drawW, drawH);

        resolve(canvas.toDataURL('image/jpeg', 0.9));
    });
}

async function _grpCreateChat() {
    const nameInput = document.getElementById('grp_nameInput');
    const groupName = nameInput ? nameInput.value.trim() : '';

    if (!groupName) {
        document.getElementById('grp_backBtn').click(); // Go back to name step
        setTimeout(() => {
            nameInput.style.borderColor = '#ef4444';
            nameInput.focus();
        }, 100);
        return;
    }

    const finalBtn = document.getElementById('grp_finalBtn');
    if (finalBtn) {
        finalBtn.disabled = true;
        finalBtn.innerText = 'Creando...';
    }

    try {
        let avatarUrl = null;

        // 1. Upload to Cloudinary if image selected
        if (window.selectedGroupAvatarBase64) {
            try {
                // Final Crop based on user pan/scroll
                const croppedBase64 = await _cropGroupAvatar();
                const token = window.AuthUtils ? window.AuthUtils.getAccessToken() : null;

                const res = await fetch('/api/imagekit/avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        image: croppedBase64,
                        context: 'group' // 🔥 Tell backend it's a group to avoid overwriting user avatar
                    })
                });
                const cloudData = await res.json();
                if (cloudData.success) {
                    avatarUrl = cloudData.url;
                }
            } catch (err) {
                console.error('Cloudinary upload error:', err);
                // Continue without avatar if upload fails? Or alert?
            }
        }

        // 2. Create conversation
        const { data: conv, error: convError } = await supabase
            .from('conversations')
            .insert({
                is_group: true,
                group_name: groupName,
                group_avatar_url: avatarUrl,
                admin_id: currentUser.id
            })
            .select()
            .single();

        if (convError) throw convError;

        // 3. Insert all participants
        const participants = [
            { conversation_id: conv.id, user_id: currentUser.id },
            ...selectedGroupUsers.map(u => ({ conversation_id: conv.id, user_id: u.id }))
        ];

        const { error: partError } = await supabase
            .from('conversation_participants')
            .insert(participants);

        if (partError) throw partError;

        // 4. Close and refresh
        closeGroupModal();
        window.selectedGroupAvatarBase64 = null; // Clear state
        await loadConversations();
        openChat(conv.id, groupName, avatarUrl, null, true);

    } catch (err) {
        console.error('createGroupChat error:', err);
        alert('Error al crear el grupo. Intenta de nuevo.');
    } finally {
        if (finalBtn) {
            finalBtn.disabled = false;
            finalBtn.innerText = 'CREAR GRUPO';
        }
    }
}

// ===== START NEW CHAT =====
async function startNewChat(targetUser) {
    if (!targetUser || targetUser.id === currentUser.id) {
        console.warn("Attempted to start chat with self. Blocked.");
        return;
    }
    const listContainer = document.getElementById('conversationsList');
    // listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Iniciando...</div>';

    // Optimized Check: Find if a common conversation already exists
    const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

    if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);

        // Find if targetUser is in any of MY conversations
        const { data: commonParticipation } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', targetUser.id)
            .in('conversation_id', myConvIds)
            .limit(1)
            .maybeSingle();

        if (commonParticipation) {
            await loadConversations();
            openChat(commonParticipation.conversation_id, targetUser.nickname, targetUser.avatar_url, targetUser.id);
            return;
        }
    }

    const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ is_group: false, admin_id: currentUser.id })
        .select()
        .single();

    if (convError) {
        console.error(convError);
        alert('Error al crear chat');
        loadConversations();
        return;
    }

    await supabase.from('conversation_participants').insert([
        { conversation_id: conv.id, user_id: currentUser.id },
        { conversation_id: conv.id, user_id: targetUser.id }
    ]);

    await loadConversations();
    openChat(conv.id, targetUser.nickname, targetUser.avatar_url, targetUser.id);
}

// ===== LOADING HELPERS =====
async function loadUserProfile() {
    try {
        const { data: profileData } = await supabase
            .from('users')
            .select('nickname, first_name')
            .eq('id', currentUser.id)
            .single();

        const myName = profileData?.nickname || profileData?.first_name || currentUser.email.split('@')[0];
        window.tempUserName = myName;
    } catch (e) {
        window.tempUserName = 'Usuario';
    }
}

function finalizeGlobalLoading() {
    // console.log("🏁 Finalizing Global Load - Revealing Inbox");
    _isInitialLoading = false;

    const tabP = document.getElementById('tabPrincipal');
    const tabG = document.getElementById('tabGrupos');
    const isOnGrupos = tabG && tabG.classList.contains('active');

    // 1. Reveal Tab text (in case it was changed to 'Cargando...')
    if (tabP && tabP.innerText.includes('...')) tabP.innerText = 'Principal';

    // 2. Hide Sidebar Skeletons & Reveal Conversation List
    const skels = document.getElementById('chatSidebarSkeletons');
    const convList = document.getElementById('conversationsList');

    if (isOnGrupos) {
        if (skels) skels.style.display = 'none';
        if (convList) {
            convList.style.display = 'block';
            convList.style.opacity = '1';
        }
    } else {
        // Normal flow — fade out skeletons, reveal Principal chats
        if (skels) {
            skels.style.transition = 'opacity 0.3s ease';
            skels.style.opacity = '0';
            setTimeout(() => {
                skels.style.display = 'none';
                if (convList) {
                    convList.style.display = 'block';
                    convList.style.opacity = '0';
                    requestAnimationFrame(() => {
                        convList.style.transition = 'opacity 0.3s ease';
                        convList.style.opacity = '1';
                    });
                }
            }, 300);
        } else if (convList) {
            convList.style.display = 'block';
            convList.style.opacity = '1';
        }
    }

    // 3. Tab Indicator — respect whichever tab is active
    const activeTab = isOnGrupos ? tabG : tabP;
    if (activeTab) {
        _updateTabIndicator(activeTab);
        const sidebar = document.querySelector('.chat-sidebar');
        if (sidebar) sidebar.style.opacity = '1';
    }

    // 4. Reveal Placeholder Content (Main Area)
    revealPlaceholderContent();
}

// ===== INSTANT CACHE RENDER (for tab switching, no Supabase call) =====
function _renderFromCache() {
    const listContainer = document.getElementById('conversationsList');
    if (!listContainer) return;

    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    if (!cachedData) {
        // No cache — fallback to full load
        loadConversations();
        return;
    }

    try {
        let chats = JSON.parse(cachedData);
        if (!chats || chats.length === 0) {
            loadConversations();
            return;
        }

        const localPinned = JSON.parse(localStorage.getItem('offszn_pinned_chats') || '[]');
        chats = chats.map(c => ({ ...c, isPinned: localPinned.includes(c.id) }));
        chats.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        renderConversationList(chats, listContainer);
    } catch (e) {
        console.error('Cache render error, falling back to full load:', e);
        loadConversations();
    }
}

// ===== LOAD CONVERSATIONS =====
async function loadConversations(opts = {}) {
    // opts.keepSkeletons = true means we simply fetch data but don't touch the DOM skeletons yet
    // because finalizeGlobalLoading will handle the "big reveal"

    const listContainer = document.getElementById('conversationsList');
    const skelDiv = document.getElementById('chatSidebarSkeletons');

    // UX OPTIMIZATION: If we already have data, don't show skeletons or clear list
    if (_loadedPrincipal && !opts.forceRefresh) {
        opts.skipSkeletons = true;
    }

    const shouldShowSkeletons = !opts.keepSkeletons && !opts.skipSkeletons;

    if (shouldShowSkeletons && skelDiv) skelDiv.style.display = 'block';
    // DON'T dim the list container yet, wait for data to render to avoid "black screen"
    // if (shouldShowSkeletons && listContainer) listContainer.style.opacity = '0.3';

    // 0. CACHING STRATEGY (Instant Load with Pinning Priority)
    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    const localPinned = JSON.parse(localStorage.getItem('offszn_pinned_chats') || '[]');

    if (cachedData && !opts.keepSkeletons) {
        // Only render from cache on SUBSEQUENT calls (tab switch, search reset)
        // On initial load (keepSkeletons=true), we skip this to show mandatory skeletons
        try {
            let cache = JSON.parse(cachedData);
            if (cache && cache.length > 0) {
                cache = cache.map(c => ({
                    ...c,
                    isPinned: localPinned.map(String).includes(String(c.id))
                }));

                cache.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.created_at) - new Date(a.created_at);
                });

                // PASS hideSkeletons: false to keep skeletons visible while cache paints
                renderConversationList(cache, listContainer, { hideSkeletons: false });
            }
        } catch (e) { console.error('Cache parse error', e); }
    }

    // 1. Get all conversations I am part of
    // DEFENSIVE: Try to fetch with is_deleted_offszn, if fails (missing column), fall back to simple query
    let participationsData = null;
    let participancyError = null;

    try {
        const { data, error } = await supabase
            .from('conversation_participants')
            .select('conversation_id, is_pinned, is_deleted_offszn')
            .eq('user_id', currentUser.id)
            .or('is_deleted_offszn.eq.false,is_deleted_offszn.is.null');

        if (error) throw error;
        participationsData = data;
    } catch (e) {
        // Fallback for when the column doesn't exist yet
        const { data, error } = await supabase
            .from('conversation_participants')
            .select('conversation_id, is_pinned')
            .eq('user_id', currentUser.id);

        participationsData = data;
        participancyError = error;
    }

    const participations = participationsData;
    const error = participancyError;

    if (error || !participations || participations.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No tienes mensajes aún.</div>';
        localStorage.removeItem('OFFSZN_CHATS_CACHE');
        revealPlaceholderContent();
        return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    // 2. Get all other participants for these conversations in one go
    const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', currentUser.id);

    const otherUserIds = [...new Set(allParticipants.map(p => p.user_id))];

    // 3. Get all other users' profiles in one go (with metadata for filtering)
    const { data: profiles } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, role, experience, daws')
        .in('id', otherUserIds);

    const profileMap = {};
    profiles.forEach(p => profileMap[p.id] = p);

    // 4. BATCH LAST MESSAGES: Fetch recent messages once to optimize speed
    // We fetch the latest 100 messages from the table; usually covers the "last message" for active chats.
    const { data: recentMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, attachment_url, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(150);

    const lastMsgMap = {};
    if (recentMessages) {
        recentMessages.forEach(msg => {
            if (!lastMsgMap[msg.conversation_id]) {
                lastMsgMap[msg.conversation_id] = msg;
            }
        });
    }

    // 5. Get conversations ordered by updated_at
    const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

    // NO CLEAR HERE: Delayed clear until renderConversationList to avoid black flicker
    if (!conversations || conversations.length === 0) {
        listContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; opacity: 0.5;">
                <p style="font-size: 0.9rem;">No tienes mensajes aún.</p>
            </div>
                    `;
        revealPlaceholderContent();
        return;
    }

    // Prepare data for rendering and cache
    const chatsToRender = [];

    conversations.forEach(conv => {
        let name, avatar, userId, isGroup = false;
        let role = null, experience = null, daws = [];
        const myParticipancy = participations.find(p => p.conversation_id === conv.id);

        // SOURCE OF TRUTH: Local Storage (Optimistic) > Database
        let isPinned = localPinned.map(String).includes(String(conv.id));

        // Initial sync: if DB says pinned and we don't have it locally, adopt it (up to limit of 3)
        const dbIsPinned = myParticipancy?.is_pinned || false;
        if (dbIsPinned && !isPinned && localPinned.length < 3) {
            isPinned = true;
            localPinned.push(String(conv.id));
            localStorage.setItem('offszn_pinned_chats', JSON.stringify(localPinned));
        }

        if (conv.is_group) {
            // GROUP CONVERSATION
            isGroup = true;
            name = escapeHTML(conv.group_name || 'Grupo');
            avatar = conv.group_avatar_url || null;
            userId = null;
        } else {
            // DM CONVERSATION
            const otherParticipancy = allParticipants.find(p => p.conversation_id === conv.id);
            if (!otherParticipancy) return;

            const profile = profileMap[otherParticipancy.user_id];
            name = escapeHTML(profile?.nickname || 'Usuario');
            avatar = profile?.avatar_url || null;
            userId = otherParticipancy.user_id;

            // Add metadata for filtering
            role = profile?.role || null;
            experience = profile?.experience || null;
            daws = profile?.daws || [];
        }

        const lastMsgObj = lastMsgMap[conv.id];
        let lastMsg = 'Empezar conversación';
        let created_at = conv.updated_at; // Fallback

        if (lastMsgObj) {
            created_at = lastMsgObj.created_at;
            if (lastMsgObj.content) {
                lastMsg = escapeHTML(lastMsgObj.content);
                if (lastMsg.length > 25) lastMsg = lastMsg.substring(0, 22) + '...';
            }
            else if (lastMsgObj.attachment_url) lastMsg = '📷 Foto';
        }

        chatsToRender.push({
            id: conv.id,
            name,
            avatar,
            lastMsg,
            created_at,
            userId,
            isGroup,
            isPinned,
            role: isGroup ? 'Grupo' : role,
            experience: isGroup ? null : experience,
            daws: isGroup ? [] : daws
        });
    });

    // Save to Cache
    localStorage.setItem('OFFSZN_CHATS_CACHE', JSON.stringify(chatsToRender));

    // Sort chats: first by pinned (isPinned DESC), then by date DESC
    chatsToRender.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Render Fresh Data
    // PASS hideSkeletons: true to finally reveal the fresh list
    // V14: Only actually hides skeletons if _isInitialLoading is false
    renderConversationList(chatsToRender, listContainer, { hideSkeletons: true });

    _loadedPrincipal = true;
    revealPlaceholderContent();
}

function revealPlaceholderContent() {
    // Only if we are NOT in an active chat
    if (!currentConversationId) {
        const ms = document.getElementById('chatMainSkeleton');
        const pc = document.getElementById('chatPlaceholderContent');
        if (ms) ms.style.display = 'none';
        if (pc) pc.style.display = 'flex';
    }
}

function renderConversationList(chats, container, opts = { hideSkeletons: true }) {
    if (!container) return;

    // V14 Guard: If we are in initial loading, we NEVER hide skeletons or clear container
    // unless explicitly forced by finalizeGlobalLoading (which sets _isInitialLoading = false)
    const shouldActuallyHide = opts.hideSkeletons && !_isInitialLoading;

    // 1. Detection: Which tab are we on?
    const tabPrincipal = document.getElementById('tabPrincipal');
    const tabGrupos = document.getElementById('tabGrupos');
    const isGroupsTab = tabGrupos && tabGrupos.classList.contains('active');

    // 2. Strict Filtering: Principal = DMs only, Grupos = Groups only
    const filteredChats = chats.filter(chat => {
        if (isGroupsTab) return chat.isGroup === true;
        // Principal Tab: ONLY Direct Messages
        return !chat.isGroup;
    });

    // 3. Delayed Clear: Clear now that we are ready to paint
    if (filteredChats.length > 0 || shouldActuallyHide) {
        container.innerHTML = '';
        container.style.opacity = '1';
    }

    // 4. Sidebar Skeletons: Hide them ONLY IF fresh data is ready AND time is up
    if (shouldActuallyHide) {
        const skelDiv = document.getElementById('chatSidebarSkeletons');
        if (skelDiv) skelDiv.style.display = 'none';
    }

    // 5. Groups Tab Specific: Add "Nuevo Grupo" button
    if (isGroupsTab && (filteredChats.length > 0 || shouldActuallyHide)) {
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'padding: 8px 16px; border-bottom: 1px solid #111;';
        headerDiv.innerHTML = `
            <button onclick="event.stopPropagation(); openGroupModal();" style="
                width: 100%;
                padding: 10px 16px;
                background: #0f0f0f;
                border: 1px solid #1a1a1a;
                border-radius: 8px;
                color: #ccc;
                font-size: 0.82rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.2s;
            " onmouseenter="this.style.background='#161616'; this.style.color='#fff'" onmouseleave="this.style.background='#0f0f0f'; this.style.color='#ccc'">
                <i class="bi bi-plus-lg" style="font-size: 0.9rem; color: #a855f7;"></i> Crear nuevo grupo
            </button>
        `;
        container.appendChild(headerDiv);
    }

    if (filteredChats.length === 0) {
        const text = isGroupsTab ? 'No tienes grupos aún.' : 'No tienes mensajes aún.';
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'padding: 40px 20px; text-align: center; color: #555;';
        emptyDiv.innerHTML = `
            <i class="bi ${isGroupsTab ? 'bi-people' : 'bi-chat-dots'}" style="font-size: 2rem; display:block; margin-bottom:10px; opacity:0.3;"></i>
            <p style="font-size:0.85rem;">${text}</p>
        `;
        container.appendChild(emptyDiv);
        return;
    }

    filteredChats.forEach(chat => {
        const timeAgoStr = formatTime(chat.created_at);
        const isPinned = chat.isPinned || false;
        const pinText = isPinned ? 'Desfijar' : 'Fijar';
        const pinIcon = isPinned ? 'bi-pin-angle' : 'bi-pin-angle-fill';

        // Check pin limit
        let pinnedCount = 0;
        try { pinnedCount = (JSON.parse(localStorage.getItem('offszn_pinned_chats')) || []).length; } catch (e) { }
        const pinDisabled = !isPinned && pinnedCount >= 3;
        const pinStyle = pinDisabled ? 'opacity: 0.35; pointer-events: none; cursor: default;' : '';

        const div = document.createElement('div');
        div.className = `offszn-v3-chat-row ${String(currentConversationId) === String(chat.id) ? 'active' : ''}`;
        div.setAttribute('data-id', chat.id);
        div.setAttribute('data-time', new Date(chat.created_at).getTime());
        div.onclick = () => openChat(chat.id, chat.name, chat.avatar, chat.userId, chat.isGroup || false);

        div.innerHTML = `
            <div class="oz-chat-avatar">
                ${chat.isGroup && !chat.avatar ?
                `<div style="width:100%;height:100%;border-radius:50%;background:#262626;display:flex;align-items:center;justify-content:center;"><i class="bi bi-people-fill" style="font-size:1.1rem;color:#8b5cf6;"></i></div>` :
                renderAvatar(chat.avatar, chat.name)
            }
            </div>
            <div class="oz-chat-info">
                <div class="offszn-v3-chat-name">
                    <span>${chat.name}</span>
                    ${isPinned ? `<i class="bi bi-pin-fill offszn-v3-pin-icon"></i>` : ''}
                </div>
                <div class="oz-chat-preview-wrap">
                    <span class="oz-chat-preview-text">${chat.lastMsg}</span>
                    <span class="oz-chat-time">${timeAgoStr}</span>
                </div>
            </div>
            <div class="offszn-v3-dots" title="Opciones">
                <i class="bi bi-three-dots"></i>
            </div>
            <div class="chat-action-menu">
                <div class="chat-action-item" onclick="togglePinChat('${chat.id}', event)" style="${pinStyle}">
                    <i class="bi ${pinIcon}"></i> ${pinText}
                </div>
                <div class="chat-action-item delete" onclick="deleteLocalChat('${chat.id}', event)">
                    <i class="bi bi-trash3"></i> Borrar
                </div>
            </div>
        `;

        // Action Menu Listener
        const dots = div.querySelector('.offszn-v3-dots');
        const menu = div.querySelector('.chat-action-menu');
        if (dots && menu) {
            dots.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.chat-action-menu.show').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });
                menu.classList.toggle('show');
            };
        }

        container.appendChild(div);
    });
}

// ===== OPEN CHAT (UPDATED) =====
async function openChat(convId, name, avatar, userId, isGroup = false) {
    toggleMobileView(true);
    currentConversationId = convId;
    localStorage.setItem('OFFSZN_LAST_CONV_ID', convId);

    // Store group flag for message rendering
    window._currentChatIsGroup = isGroup;

    // 4. Update Header
    cancelReply(); // FIX: Clear any lingering reply preview
    const placeholder = document.getElementById('chatPlaceholder');
    const activeCont = document.getElementById('activeChatContainer');

    // Hide all skeletons if any
    const mainSkeleton = document.getElementById('chatMainSkeleton');
    if (mainSkeleton) mainSkeleton.style.display = 'none';

    if (placeholder) placeholder.style.display = 'none';
    activeCont.style.display = 'flex';

    // Show message skeletons while loading
    const messagesFeed = document.getElementById('messagesList'); // Re-checking the id in mensajes.html
    const messagesFeedInner = document.querySelector('.messages-feed-inner');
    if (messagesFeedInner) {
        messagesFeedInner.innerHTML = _renderMessageSkeletons();
    }

    // Update active state in sidebar
    document.querySelectorAll('.offszn-v3-chat-row').forEach(item => {
        item.classList.toggle('active', String(item.getAttribute('data-id')) === String(convId));
    });

    // Update header
    let roleText = '';
    let socials = {};

    if (isGroup) {
        // GROUP HEADER: show member count
        const { data: members } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', convId);
        roleText = `${members ? members.length : '?'} miembros`;
    } else if (userId) {
        const { data: userDetails } = await supabase
            .from('users')
            .select('role, is_producer, socials')
            .eq('id', userId)
            .single();

        if (userDetails) {
            if (userDetails.is_producer) {
                roleText = "Productor musical";
            } else if (userDetails.role && userDetails.role !== 'user') {
                roleText = userDetails.role.charAt(0).toUpperCase() + userDetails.role.slice(1);
            }
            socials = userDetails.socials || {};
            if (typeof socials === 'string') {
                try { socials = JSON.parse(socials); } catch (e) { socials = {}; }
            }
        }
    }

    const nameEl = document.getElementById('currentChatName');
    nameEl.textContent = name;

    if (isGroup) {
        nameEl.style.cursor = 'default';
        nameEl.onclick = null;
    } else {
        nameEl.style.cursor = 'pointer';
        nameEl.onclick = () => window.location.href = `/ @${name} `;
    }

    const avatarEl = document.getElementById('currentChatAvatar');
    if (isGroup && !avatar) {
        avatarEl.innerHTML = `<div style="width:100%;height:100%;border-radius:50%;background:#262626;display:flex;align-items:center;justify-content:center;"><i class="bi bi-people-fill" style="font-size:1.2rem;color:#8b5cf6;"></i></div>`;
        avatarEl.style.cursor = 'default';
        avatarEl.onclick = null;
    } else {
        avatarEl.innerHTML = renderAvatar(avatar, name);
        avatarEl.style.cursor = 'pointer';
        avatarEl.onclick = () => window.location.href = isGroup ? '#' : `/ @${name} `;
    }

    document.getElementById('currentChatStatus').textContent = roleText;

    // RENDER SOCIALS IN HEADER DROPDOWN (Skip for groups)
    const actionsContainer = document.querySelector('.chat-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';
        if (isGroup) {
            // No socials dropdown for group chats
        } else {
            const icons = {
                instagram: 'bi-instagram',
                tiktok: 'bi-tiktok',
                youtube: 'bi-youtube',
                spotify: 'bi-spotify',
                twitter: 'bi-twitter-x'
            };

            // Custom order as requested: IG, TT, YT
            const order = ['instagram', 'tiktok', 'youtube'];
            const socialKeys = Object.keys(socials).sort((a, b) => {
                const idxA = order.indexOf(a.toLowerCase());
                const idxB = order.indexOf(b.toLowerCase());
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });

            const activeSocials = socialKeys.filter(k => socials[k]);

            if (activeSocials.length > 0) {
                // Create Three Dots Button
                const moreBtn = document.createElement('button');
                moreBtn.className = 'header-more-btn';
                moreBtn.innerHTML = '<i class="bi bi-three-dots"></i>';

                // Create Dropdown Container
                const dropdown = document.createElement('div');
                dropdown.className = 'header-socials-dropdown';
                dropdown.id = 'headerSocialsDropdown';

                activeSocials.forEach(key => {
                    const k = key.toLowerCase();
                    const val = socials[key];
                    if (val && icons[k]) {
                        const a = document.createElement('a');
                        let href = val;
                        if (!val.startsWith('http')) {
                            if (k === 'instagram') href = `https://instagram.com/${val}`;
                            else if (k === 'tiktok') href = `https://tiktok.com/@${val}`;
                            else if (k === 'youtube') href = `https://youtube.com/@${val}`;
                        }
                        a.href = href;
                        a.target = '_blank';
                        a.className = 'dropdown-social-item';

                        // Capitalize label for UI
                        const label = k.charAt(0).toUpperCase() + k.slice(1);
                        a.innerHTML = `<i class="bi ${icons[k]}"></i> <span>${label}</span>`;
                        dropdown.appendChild(a);
                    }
                });

                moreBtn.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                };

                actionsContainer.appendChild(moreBtn);
                actionsContainer.appendChild(dropdown);
            }
        } // end else (not group)
    }

    const feedInner = document.getElementById('messagesFeedInner');
    feedInner.innerHTML = _renderMessageSkeletons();

    const { data: messages } = await supabase
        .from('messages')
        .select(`
            *, 
            sender:users!sender_id(nickname, avatar_url),
            message_reactions(user_id, emoji),
            parent:reply_to_id(
                content, 
                sender_id, 
                attachment_type,
                sender:users!sender_id(nickname)
            )
        `)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

    feedInner.innerHTML = '';
    if (messages) {
        messages.forEach(msg => renderMessage(msg));
    }
    // Delay scroll slightly to ensure DOM is fully ready
    requestAnimationFrame(() => {
        scrollToBottom();
    });
}



// ===== SEND MESSAGE =====
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !currentConversationId) return;

    input.value = '';
    input.style.height = 'auto'; // Reset the computed height so it shrinks back

    // Optimistic UI for chat bubble
    const renderTime = Date.now();

    // Find parent message info if this is a reply
    let parentData = null;
    if (replyToId) {
        const parentEl = document.getElementById(`msg-${replyToId}`);
        if (parentEl) {
            const content = parentEl.querySelector('.oz-bubble').textContent.trim();
            const chatName = document.getElementById('currentChatName').textContent;
            const isParentMe = parentEl.classList.contains('sent');
            parentData = {
                content: content,
                sender_id: isParentMe ? currentUser.id : 'other',
                sender: { nickname: isParentMe ? 'ti mismo' : chatName }
            };
        }
    }

    renderMessage({
        id: renderTime, // Temporary ID for mapping
        sender_id: currentUser.id,
        content: text,
        created_at: new Date().toISOString(),
        parent: parentData // Include for optimistic quote
    });
    scrollToBottom();

    // UPDATE SIDEBAR PREVIEW IMMEDIATELY
    const currentItem = document.querySelector(`.chat-item[data-id="${currentConversationId}"]`);
    if (currentItem) {
        const preview = currentItem.querySelector('.chat-preview');
        if (preview) {
            let shortText = text.length > 25 ? text.substring(0, 22) + '...' : text;
            preview.textContent = `${shortText} • Ahora`;
        }
        const list = document.getElementById('conversationsList');
        if (list) list.prepend(currentItem);
    }

    const { data: msgData, error } = await supabase.from('messages').insert({
        conversation_id: currentConversationId,
        sender_id: currentUser.id,
        content: text,
        reply_to_id: replyToId // Include reply if exists
    }).select().single();

    if (replyToId) cancelReply(); // Clear reply after sending

    if (error) {
        console.error('Error sending message:', error);
        return;
    }

    // UPDATE DOM WITH REAL ID
    const tempId = `msg-${renderTime}`;
    const msgDiv = document.getElementById(tempId);
    if (msgDiv && msgData) {
        msgDiv.id = `msg-${msgData.id}`;
        // Update action buttons with real ID
        const replyBtn = msgDiv.querySelector('.msg-action-btn i.bi-reply-fill')?.parentElement;
        const reactBtn = msgDiv.querySelector('.msg-action-btn i.bi-emoji-smile')?.parentElement;

        if (replyBtn) {
            replyBtn.setAttribute('onclick', `onReplyClick('${msgData.id}', 'Tú', '${text.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')`);
        }
        if (reactBtn) {
            reactBtn.setAttribute('onclick', `onReactClick('${msgData.id}', event)`);
            reactBtn.style.opacity = '1';
            reactBtn.style.pointerEvents = 'auto';
        }
    }

    await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentConversationId);

    // SEND NOTIFICATION
    try {
        const { data: parts } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', currentConversationId)
            .neq('user_id', currentUser.id);

        if (parts && parts.length > 0) {
            const otherId = parts[0].user_id;
            const { data: myProfile } = await supabase.from('users').select('nickname').eq('id', currentUser.id).single();
            const myNick = myProfile?.nickname || "Alguien";

            await supabase.from('notifications').insert({
                user_id: otherId,
                type: 'new_message',
                title: 'Nuevo Mensaje',
                message: `Envío un mensaje: "${text.length > 50 ? text.substring(0, 47) + '...' : text}"`,
                data: { conversation_id: currentConversationId, sender_id: currentUser.id },
                read: false
            });
        }
    } catch (e) {
        console.warn("Failed to send notification:", e);
    }
}

// ===== RENDER MESSAGE =====
function renderMessage(msg) {
    const feedInner = document.getElementById('messagesFeedInner');
    if (!feedInner) return;

    const isMe = msg.sender_id === currentUser.id;
    const msgDiv = document.createElement('div');
    // Namespace update: .message -> .oz-message-row
    msgDiv.className = `oz-message-row ${isMe ? 'sent' : 'received'}`;
    msgDiv.id = `msg-${msg.id || Date.now()}`;
    msgDiv.setAttribute('data-time', msg.created_at);

    // 1. DATE HEADER
    const lastMsgNode = feedInner.lastElementChild;
    const lastTime = lastMsgNode ? new Date(lastMsgNode.getAttribute('data-time')) : null;
    const currTime = new Date(msg.created_at);

    if (!lastTime || (currTime - lastTime > 3600000)) { // 1 hour gap
        const header = document.createElement('div');
        header.className = 'oz-date-header'; // Updated class
        header.textContent = formatMessageDate(msg.created_at);
        feedInner.appendChild(header);
    }

    // Current sender name (for received headers and reply actions)
    const senderData = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
    const senderNick = escapeHTML(senderData?.nickname || 'Usuario');

    // 2. REPLY PREVIEW
    let replyHtml = '';
    // Handle array or object return from Supabase
    const parentMsg = Array.isArray(msg.parent) ? msg.parent[0] : msg.parent;

    if (parentMsg) {
        const pContent = parentMsg.content || (parentMsg.attachment_type === 'image' ? '📷 Foto' : '');

        if (pContent) {
            const shortReply = pContent.length > 50 ? pContent.substring(0, 47) + '...' : pContent;
            const pIsMe = parentMsg.sender_id === currentUser.id;

            // Parent sender name
            const parentSenderData = Array.isArray(parentMsg.sender) ? parentMsg.sender[0] : parentMsg.sender;
            const parentNick = escapeHTML(parentSenderData?.nickname || 'Usuario');

            const pIsSender = parentMsg.sender_id === msg.sender_id;

            let headerText = '';
            if (isMe) {
                headerText = pIsMe ? 'Te respondiste a ti mismo' : `Respondiste a ${parentNick}`;
            } else {
                if (pIsMe) {
                    headerText = `${senderNick} te ha respondido`;
                } else if (pIsSender) {
                    headerText = `${senderNick} se respondió a sí mismo`;
                } else {
                    headerText = `${senderNick} respondió a ${parentNick}`;
                }
            }

            replyHtml = `
            <div class="oz-reply-header">${headerText}</div>
            <div class="reply-quote-container" onclick="scrollToMessage('${msg.reply_to_id}')">
                <div class="reply-quote-text">${shortReply.replace(/</g, "&lt;")}</div>
            </div>`;
        }
    }

    const actionsHtml = `
        <div class="oz-message-actions"> <!-- Updated class -->
            <button class="msg-action-btn" onclick="onReactClick('${msg.id}', event)" ${!msg.id ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                <i class="bi bi-emoji-smile"></i>
            </button>
            <button class="msg-action-btn" onclick="onReplyClick('${msg.id}', '${isMe ? 'Tú' : (senderNick.replace(/'/g, "\\'"))}', '${msg.content?.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" ${!msg.id ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                <i class="bi bi-reply-fill"></i>
            </button>
            <div class="oz-menu-container">
                <button class="msg-action-btn" onclick="toggleMessageMenu('${msg.id}', event)" ${!msg.id ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
                    <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div id="menu-${msg.id}" class="oz-msg-menu">
                    <div class="oz-menu-item" onclick="copyMessageText('${msg.id}', event)">
                        <i class="bi bi-clipboard"></i> Copiar
                    </div>
                </div>
            </div>
        </div>
    `;

    // 4. REACTIONS RENDER
    let reactionHtml = '';
    const reactions = msg.message_reactions || [];
    // Just show the last one or accumulate? 
    // User wants "like image 3". Image 3 shows one small bubble on the message.
    // Usually we show the reaction made by ME or just a summary. 
    // "replace the one that was already there" implies 1 reaction per user.
    // We can show all unique reactions or just mine? 
    // If there are multiple users, we might show multiple icons? 
    // The requirement says "replace", implying a singular state per user.
    // Let's show the reaction made by ANYONE. If multiple people react, show the last one? 
    // Or stack them?
    // "Image 3" shows one heart. 
    // I will render the reaction from the user relevant (or just the last one added if multiple).

    if (reactions.length > 0) {
        // Find my reaction or just the first one
        const myReaction = reactions.find(r => r.user_id === currentUser.id);
        const displayEmoji = myReaction ? myReaction.emoji : reactions[reactions.length - 1].emoji;

        if (displayEmoji) {
            const clickAction = myReaction ? `removeReaction('${msg.id}', event)` : `submitReaction('${msg.id}', '${displayEmoji}', event)`;
            reactionHtml = `<div class="message-reaction-bubble" onclick="${clickAction}">${displayEmoji}</div>`;
        }
    }

    // 4. CONTENT - CONTENT
    let contentHtml = '';
    if (msg.attachment_url && msg.attachment_type === 'image') {
        contentHtml = `<img src="${msg.attachment_url}" style="max-height: 250px; border-radius: 12px; cursor: pointer; display: block;" onclick="window.open('${msg.attachment_url}', '_blank')">`;
    } else {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const rawContent = escapeHTML(msg.content || '');
        contentHtml = rawContent.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`);
    }

    // Structure matches Image 2 and modern chat apps
    const avatarHtml = !isMe ? `
        <div class="oz-msg-avatar">
            ${renderAvatar(senderData?.avatar_url, senderData?.nickname)}
        </div>
    ` : '';

    // GROUP CHAT: Show sender name above received messages
    const groupSenderLabel = (!isMe && window._currentChatIsGroup)
        ? `<div style="font-size:0.75rem;font-weight:600;color:#8B5CF6;margin-bottom:2px;padding-left:4px;">${senderNick}</div>`
        : '';

    msgDiv.innerHTML = `
        ${avatarHtml}
        <div class="oz-msg-body">
            ${groupSenderLabel}
            ${replyHtml}
            <div class="oz-msg-container">
                <div class="oz-bubble">
                    ${contentHtml}
                    ${reactionHtml}
                </div>
                ${actionsHtml}
            </div>
            ${isMe ? `<div class="oz-time">${formatMessageDate(msg.created_at).split(' ')[0]}</div>` : ''} 
        </div>
    `;

    feedInner.appendChild(msgDiv);
}

function formatMessageDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function scrollToMessage(id) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash animation Instagram-style
        el.classList.add('oz-highlight');
        setTimeout(() => el.classList.remove('oz-highlight'), 1500);
    }
}

function onReplyClick(id, author, text) {
    replyToId = id;
    const container = document.getElementById('replyPreviewContainer');
    const userEl = document.getElementById('replyPreviewUser');
    const textEl = document.getElementById('replyPreviewText');
    if (container) {
        userEl.textContent = author === 'Tú' ? 'Respondiendo a ti mismo' : `Respondiendo a ${author}`;
        // Unescape &quot; for display
        const decodedText = text.replace(/&quot;/g, '"').replace(/\\'/g, "'");
        // Truncate for input preview
        const short = decodedText.length > 80 ? decodedText.substring(0, 77) + '...' : decodedText;
        textEl.textContent = short;
        container.style.display = 'flex';
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }
}

function cancelReply() {
    replyToId = null;
    const container = document.getElementById('replyPreviewContainer');
    if (container) container.style.display = 'none';
}

function onReactClick(msgId, event) {
    if (event) event.stopPropagation();

    // Close existing
    const existing = document.querySelector('.reaction-popover');
    if (existing) existing.remove();

    // Create Picker
    const popover = document.createElement('div');
    popover.className = 'reaction-popover';
    popover.innerHTML = `
        <span class="reaction-option" onclick="submitReaction('${msgId}', '👍', event)">👍</span>
        <span class="reaction-option" onclick="submitReaction('${msgId}', '👎', event)">👎</span>
        <span class="reaction-option" onclick="submitReaction('${msgId}', '🔥', event)">🔥</span>
        <span class="reaction-option" onclick="submitReaction('${msgId}', '✅', event)">✅</span>
    `;

    // Attach to button
    const btn = event.currentTarget;
    // Ensure relative positioning context if needed, but absolute positioning in CSS handles it relative to parent or button?
    // Since .msg-action-btn is inside .message-actions (flex), position absolute might be relative to body if parents usually are static.
    // But .message-actions is static. .message is relative!
    // Let's append to button and rely on button position.
    btn.style.position = 'relative';
    btn.appendChild(popover);

    // Close handler
    const closeHandler = (e) => {
        if (!popover.contains(e.target) && e.target !== btn) {
            popover.remove();
            document.removeEventListener('click', closeHandler);
            btn.style.position = ''; // Reset
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

async function submitReaction(msgId, emoji, event) {
    if (event) event.stopPropagation();

    // Close picker
    const existing = document.querySelector('.reaction-popover');
    if (existing) existing.remove();

    // 1. OPTIMISTIC UI UPDATE
    const msgDiv = document.getElementById(`msg-${msgId}`);
    if (msgDiv) {
        const bubble = msgDiv.querySelector('.oz-bubble'); // CORRECTED SELECTOR
        let reactionEl = bubble.querySelector('.message-reaction-bubble');
        if (!reactionEl) {
            reactionEl = document.createElement('div');
            reactionEl.className = 'message-reaction-bubble';
            bubble.appendChild(reactionEl);
        }
        reactionEl.textContent = emoji;
    }

    // 2. DB UPDATE
    const { error } = await supabase
        .from('message_reactions')
        .upsert({
            message_id: msgId,
            user_id: currentUser.id,
            emoji: emoji // Fixed column name from 'reaction' to 'emoji'
        }, { onConflict: 'message_id, user_id, emoji' }); // Matching user PK constraint

    if (error) {
        console.error('Error adding reaction:', error);
        // Revert UI?
    }
}

async function removeReaction(msgId, event) {
    if (event) event.stopPropagation();

    // 1. OPTIMISTIC UI UPDATE
    const msgDiv = document.getElementById(`msg-${msgId}`);
    if (msgDiv) {
        const bubble = msgDiv.querySelector('.oz-bubble');
        const reactionEl = bubble?.querySelector('.message-reaction-bubble');
        if (reactionEl) reactionEl.remove();
    }

    // 2. DB UPDATE
    const { error } = await supabase
        .from('message_reactions')
        .delete()
        .match({ message_id: msgId, user_id: currentUser.id });

    if (error) {
        console.error('Error removing reaction:', error);
    }
}

// ===== HELPERS =====
function renderAvatar(url, name) {
    if (url && url.length > 10) {
        return `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
    const safeName = escapeHTML(name || 'U');
    const initial = safeName.charAt(0).toUpperCase();
    return `<div style="width:100%; height:100%; background:#333; color:#a78bfa; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.2rem; border-radius:50%; border:1px solid #444;">${initial}</div>`;
}

function scrollToBottom() {
    const feed = document.getElementById('messagesFeed');
    if (feed) {
        feed.scrollTop = feed.scrollHeight;
    }
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) return `Hoy, ${timeStr}`;
    if (isYesterday) return `Ayer, ${timeStr}`;
    return `${date.getDate()}/${date.getMonth() + 1}, ${timeStr}`;
}

// ===== REALTIME =====
function setupRealtime() {
    supabase.channel('public:messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, payload => {
            if (payload.new.conversation_id === currentConversationId) {
                if (payload.new.sender_id !== currentUser.id) {
                    // Refresh entire conversation to get joins correctly? 
                    // Or blindly render? The optimized way is to render. 
                    // BUT Realtime payload DOES NOT include Joined tables (parent).
                    // We must fetch the single message with join to show the reply correctly.
                    fetchSingleMessage(payload.new.id).then(fullMsg => {
                        if (fullMsg) {
                            renderMessage(fullMsg);
                            scrollToBottom();
                        }
                    });

                    const item = document.querySelector(`.chat-item[data-id="${currentConversationId}"]`);
                    if (item) {
                        const preview = item.querySelector('.chat-preview');
                        const text = payload.new.content || '📷 Foto';
                        const short = text.length > 25 ? text.substring(0, 22) + '...' : text;
                        if (preview) {
                            preview.innerHTML = `
                                <span class="chat-preview-text">${short}</span>
                                <span class="chat-preview-date">Ahora</span>
                            `;
                        }

                        // ONLY PREPEND IF PRINCIPAL IS ACTIVE
                        const tabPrincipal = document.getElementById('tabPrincipal');
                        if (tabPrincipal && tabPrincipal.classList.contains('active')) {
                            const list = document.getElementById('conversationsList');
                            if (list) list.prepend(item);
                        }
                    }
                }
            } else {
                // ONLY UPDATE LIST IF PRINCIPAL IS ACTIVE
                const tabPrincipal = document.getElementById('tabPrincipal');
                if (tabPrincipal && tabPrincipal.classList.contains('active')) {
                    const item = document.querySelector(`.chat-item[data-id="${payload.new.conversation_id}"]`);
                    if (item) {
                        const preview = item.querySelector('.chat-preview');
                        const text = payload.new.content || '📷 Foto';
                        const short = text.length > 25 ? text.substring(0, 22) + '...' : text;
                        if (preview) {
                            preview.innerHTML = `
                                <span class="chat-preview-text">${short}</span>
                                <span class="chat-preview-date">Ahora</span>
                            `;
                        }
                        const list = document.getElementById('conversationsList');
                        if (list) list.prepend(item);
                    } else {
                        loadConversations();
                    }
                }
            }
        })
        .subscribe();

    // LISTEN FOR REACTIONS TOO
    supabase.channel('public:reactions')
        .on('postgres_changes', {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'message_reactions'
        }, payload => {
            if (!currentConversationId) return;

            // Ideally we check if the message belongs to current convo. 
            // But payload doesn't have conversation_id, only message_id.
            // We can check if the message ID corresponds to a message currently in DOM.
            const msgId = payload.new ? payload.new.message_id : payload.old.message_id;
            const msgDiv = document.getElementById(`msg-${msgId}`);

            if (msgDiv) {
                // Determine what to show.
                // Since this is realtime from ANOTHER user, we really should fetch the latest state
                // or trust the payload. 
                // Creating a simplified update logic:
                const bubble = msgDiv.querySelector('.oz-bubble'); // CORRECTED SELECTOR
                let reactionEl = bubble.querySelector('.message-reaction-bubble');

                if (payload.eventType === 'DELETE') {
                    // Check if there are other reactions? 
                    // To do this strictly correctly, we need the count or list.
                    // For now, if we receive a DELETE, we might just hide it.
                    if (reactionEl) reactionEl.remove();
                } else {
                    // INSERT or UPDATE
                    if (!reactionEl) {
                        reactionEl = document.createElement('div');
                        reactionEl.className = 'message-reaction-bubble';
                        bubble.appendChild(reactionEl);
                    }
                    reactionEl.textContent = payload.new.emoji;
                }
            }
        })
        .subscribe();
}


// ===== MODAL LOGIC (New Message) =====

let selectedUserForChat = null;

function openNewMessageModal() {
    const overlay = document.getElementById('newMessageModalOverlay');
    const input = document.getElementById('modalSearchInput');

    if (overlay) {
        overlay.style.display = 'flex';
        // Force reflow for animation
        setTimeout(() => overlay.classList.add('active'), 10);

        if (input) {
            input.value = '';
            input.focus();
            // Load initial suggestions (e.g. recent or random)
            searchUsersForModal('');
        }
    }
}

function closeNewMessageModal(e) {
    if (e && e.target !== e.currentTarget) return; // Only if clicked on overlay or close button

    const overlay = document.getElementById('newMessageModalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            selectedUserForChat = null;
            updateModalChatButton();
        }, 210);
    }
}

async function searchUsersForModal(query) {
    const list = document.getElementById('modalResultsList');
    // Using simple HTML string for skeleton here
    list.innerHTML = `
        <div class="modal-skeleton-item">
            <div class="modal-skeleton-avatar skeleton-pulse"></div>
            <div class="modal-skeleton-text">
                <div class="modal-skeleton-line skeleton-pulse"></div>
                <div class="modal-skeleton-line short skeleton-pulse"></div>
            </div>
        </div>
        <div class="modal-skeleton-item">
            <div class="modal-skeleton-avatar skeleton-pulse"></div>
            <div class="modal-skeleton-text">
                <div class="modal-skeleton-line skeleton-pulse"></div>
                <div class="modal-skeleton-line short skeleton-pulse"></div>
            </div>
        </div>
        <div class="modal-skeleton-item">
            <div class="modal-skeleton-avatar skeleton-pulse"></div>
            <div class="modal-skeleton-text">
                <div class="modal-skeleton-line skeleton-pulse"></div>
                <div class="modal-skeleton-line short skeleton-pulse"></div>
            </div>
        </div>
    `;

    let dbQuery = supabase
        .from('users')
        .select('id, nickname, avatar_url, first_name, last_name')
        .not('nickname', 'is', null)
        .not('first_name', 'is', null)
        .neq('id', currentUser.id)
        .limit(20);

    if (query && query.length > 0) {
        dbQuery = dbQuery.ilike('nickname', `%${query}%`);
    } else {
        dbQuery = dbQuery.limit(10);
    }

    const { data: users, error } = await dbQuery;

    if (error || !users || users.length === 0) {
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: #666; font-size: 0.9rem;">No se encontraron cuentas.</div>`;
        return;
    }

    list.innerHTML = '';
    users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'chat-modal-item';
        item.onclick = () => selectUserInModal(u, item);

        const isSelected = selectedUserForChat && selectedUserForChat.id === u.id;
        if (isSelected) item.classList.add('selected');

        const avatarUrl = u.avatar_url;
        const initial = u.nickname && u.nickname.length > 0 ? u.nickname.charAt(0).toUpperCase() : '?';

        let avatarHtml = '';
        if (avatarUrl && avatarUrl.length > 10) {
            avatarHtml = `<img src="${avatarUrl}" alt="${u.nickname}">`;
        } else {
            avatarHtml = `<div style="width:100%; height:100%; background:#333; color:#a78bfa; display:flex; align-items:center; justify-content:center; font-weight:700;">${initial}</div>`;
        }

        item.innerHTML = `
            <div class="chat-modal-avatar">
                ${avatarHtml}
            </div>
            <div class="chat-modal-user-info">
                <div class="chat-modal-username">${escapeHTML(u.nickname)}</div>
                <div class="chat-modal-fullname">${escapeHTML(u.first_name || '')} ${escapeHTML(u.last_name || '')}</div>
            </div>
            <div class="chat-modal-selection"></div>
        `;
        list.appendChild(item);
    });
}

// Search Input Listener for Modal
const modalInput = document.getElementById('modalSearchInput');
if (modalInput) {
    let debounce;
    modalInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => searchUsersForModal(e.target.value), 300);
    });
}

function selectUserInModal(user, domItem) {
    if (selectedUserForChat && selectedUserForChat.id === user.id) {
        selectedUserForChat = null;
        domItem.classList.remove('selected');
    } else {
        document.querySelectorAll('.chat-modal-item.selected').forEach(el => el.classList.remove('selected'));
        selectedUserForChat = user;
        domItem.classList.add('selected');
    }
    updateModalChatButton();
}

function updateModalChatButton() {
    const btn = document.getElementById('modalChatBtn');
    if (selectedUserForChat) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
}

async function startChatFromModal() {
    if (!selectedUserForChat) return;

    const userToChat = selectedUserForChat;
    window.closeNewMessageModal();

    // Switch to active chat immediately with skeletons enabled by startNewChat logic if needed
    // or just let startNewChat handle it. 

    await startNewChat(userToChat);
}

function adjustInputHeight(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// ===== MESSAGE ACTIONS MENU =====

function toggleMessageMenu(msgId, event) {
    event.stopPropagation();
    // Close any other open menus first
    document.querySelectorAll('.oz-msg-menu.active').forEach(m => {
        if (m.id !== `menu-${msgId}`) m.classList.remove('active');
    });

    const menu = document.getElementById(`menu-${msgId}`);
    if (menu) {
        menu.classList.toggle('active');
    }
}

// Close menus on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.oz-msg-menu.active').forEach(m => m.classList.remove('active'));
    document.querySelectorAll('.header-socials-dropdown.active').forEach(m => m.classList.remove('active'));
});

async function copyMessageText(msgId, event) {
    if (event) event.stopPropagation();
    const msgDiv = document.getElementById(`msg-${msgId}`);
    if (!msgDiv) return;

    // Get text from bubble (excluding reaction pill)
    const bubble = msgDiv.querySelector('.oz-bubble');
    if (!bubble) return;

    // Clone to remove the reaction bubble if present before getting text
    const tempBubble = bubble.cloneNode(true);
    const reaction = tempBubble.querySelector('.message-reaction-bubble');
    if (reaction) reaction.remove();

    const text = tempBubble.innerText.trim();

    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(msgId);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}

function showCopyFeedback(msgId) {
    const menuEl = document.querySelector(`#menu-${msgId} .oz-menu-item`);
    if (menuEl) {
        const originalHtml = menuEl.innerHTML;
        menuEl.innerHTML = '<i class="bi bi-check2"></i> ¡Copiado!';
        menuEl.style.color = '#34d399'; // Positive green

        setTimeout(() => {
            menuEl.innerHTML = originalHtml;
            menuEl.style.color = '';
            // Close menu after feedback
            document.getElementById(`menu-${msgId}`).classList.remove('active');
        }, 1200);
    }
}

async function fetchSingleMessage(id) {
    const { data } = await supabase
        .from('messages')
        .select(`
            *, 
            sender:users!sender_id(nickname, avatar_url),
            message_reactions(user_id, emoji),
            parent:reply_to_id(
                content, 
                sender_id, 
                attachment_type,
                sender:users!sender_id(nickname)
            )
        `)
        .eq('id', id)
        .single();
    return data;
}



// Close action menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.offszn-v3-dots') && !e.target.closest('.chat-action-menu')) {
        document.querySelectorAll('.chat-action-menu.show').forEach(m => m.classList.remove('show'));
    }
});

// Context Menu Handlers
window.togglePinChat = async function (convId, e) {
    if (e) e.stopPropagation();

    const row = document.querySelector(`.offszn-v3-chat-row[data-id="${convId}"]`);
    if (!row) return;

    // 1. OPTIMISTIC UPDATE: Instant UI feedback
    let currentPinned = [];
    try { currentPinned = JSON.parse(localStorage.getItem('offszn_pinned_chats')) || []; } catch (e) { }

    const isNowPinned = !currentPinned.includes(convId);

    // LIMIT CHECK: Max 3 pinned
    if (isNowPinned && currentPinned.length >= 3) {
        const menu = row.querySelector('.chat-action-menu');
        if (menu) menu.classList.remove('show');
        return;
    }

    // CLOSE MENU IMMEDIATELY
    const menu = row.querySelector('.chat-action-menu');
    if (menu) menu.classList.remove('show');

    // Update icons and text in DOM immediately
    const nameDiv = row.querySelector('.offszn-v3-chat-name');
    const pinActionItem = row.querySelector('.chat-action-item'); // The first item is always Pin/Unpin

    if (isNowPinned) {
        // Add pin icon to row
        if (!nameDiv.querySelector('.offszn-v3-pin-icon')) {
            const pIcon = document.createElement('i');
            pIcon.className = 'bi bi-pin-fill offszn-v3-pin-icon';
            nameDiv.appendChild(pIcon);
        }
        // Update menu internal
        if (pinActionItem) {
            pinActionItem.innerHTML = `<i class="bi bi-pin-angle"></i> Desfijar`;
        }
    } else {
        // Remove pin icon from row
        const pIcon = nameDiv.querySelector('.offszn-v3-pin-icon');
        if (pIcon) pIcon.remove();
        // Update menu internal
        if (pinActionItem) {
            pinActionItem.innerHTML = `<i class="bi bi-pin-angle-fill"></i> Fijar`;
        }
    }

    // Update local cache pointers
    if (isNowPinned) {
        currentPinned.push(convId);
    } else {
        currentPinned = currentPinned.filter(id => id !== convId);
    }
    localStorage.setItem('offszn_pinned_chats', JSON.stringify(currentPinned));

    // Update the OFFSZN_CHATS_CACHE if it exists
    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    if (cachedData) {
        try {
            let cache = JSON.parse(cachedData);
            const chatIdx = cache.findIndex(c => c.id === convId);
            if (chatIdx !== -1) {
                cache[chatIdx].isPinned = isNowPinned;
                localStorage.setItem('OFFSZN_CHATS_CACHE', JSON.stringify(cache));
            }
        } catch (e) { }
    }

    // REORDER DOM IMMEDIATELY
    const container = row.parentElement;
    if (container) {
        if (isNowPinned) {
            // Move to top (or after other pinned)
            container.prepend(row);
        } else {
            // Re-sort chronologically among non-pinned
            const rows = Array.from(container.children);
            const myTime = parseInt(row.getAttribute('data-time') || 0);

            // Find the correct spot: after all pinned, then by time DESC
            let inserted = false;
            for (const other of rows) {
                if (other === row) continue;
                const otherIsPinned = !!other.querySelector('.bi-pin-fill');
                const otherTime = parseInt(other.getAttribute('data-time') || 0);

                if (!otherIsPinned && otherTime < myTime) {
                    container.insertBefore(row, other);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) container.appendChild(row);
        }
    }

    // 2. BACKGROUND SYNC
    try {
        const { error } = await supabase
            .from('conversation_participants')
            .update({ is_pinned: isNowPinned })
            .eq('conversation_id', convId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    } catch (err) {
        console.error('Error syncing pin to DB:', err);
    }
};

window.deleteLocalChat = async function (convId, e) {
    if (e) e.stopPropagation();
    if (!confirm('¿Seguro que deseas eliminar este chat? Desaparecerá de tu lista hasta recibir un nuevo mensaje.')) return;

    // 1. OPTIMISTIC UPDATE: Hide instantly
    // FIXED SELECTOR: Targeted the specific chat row class
    const item = document.querySelector(`.offszn-v3-chat-row[data-id="${convId}"]`);
    if (item) {
        item.style.opacity = '0';
        item.style.transition = 'opacity 0.2s ease';
        setTimeout(() => item.remove(), 200);
    }

    if (currentConversationId === convId) {
        document.getElementById('activeChatContainer').style.display = 'none';
        const placeholder = document.getElementById('chatPlaceholder');
        if (placeholder) {
            // Instant Reset - No skeletons for deletion speed
            const msgList = document.getElementById('messagesList');
            if (msgList) msgList.innerHTML = '';
            placeholder.style.display = 'flex';
        }
        currentConversationId = null;
    }

    // Update Local Cache instantly so refreshing doesn't bring it back
    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    if (cachedData) {
        try {
            let cache = JSON.parse(cachedData);
            cache = cache.filter(c => String(c.id) !== String(convId));
            localStorage.setItem('OFFSZN_CHATS_CACHE', JSON.stringify(cache));
        } catch (e) { }
    }

    // 2. BACKGROUND SYNC (AWAIT THIS BEFORE REFRESH TO PREVENT REAPPEARING)
    try {
        const { error } = await supabase
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', convId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    } catch (err) {
        console.error('Error deleting chat from DB:', err);
    }

    // 3. TRIGGER SILENT REFRESH (Background sync - now safe because DB is updated)
    loadConversations({ forceRefresh: true, skipSkeletons: true });
};

// =========================================
// ADVANCED FILTER LOGIC
// =========================================
let activeFilters = {
    role: [],
    experience: [],
    daws: []
};

function setupFilterListeners() {
    const filterBtn = document.getElementById('btnFilterChats');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            window.openFilterOverlay();
        });
    }

    // Chip selection logic
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.getAttribute('data-type'); // role, experience, daw
            const value = chip.getAttribute('data-value');
            const dataKey = type === 'daw' ? 'daws' : type;

            if (chip.classList.contains('active')) {
                chip.classList.remove('active');
                activeFilters[dataKey] = activeFilters[dataKey].filter(v => v !== value);
            } else {
                chip.classList.add('active');
                activeFilters[dataKey].push(value);
            }
        });
    });
}

window.openFilterOverlay = function () {
    const overlay = document.getElementById('filterOverlay');
    if (overlay) overlay.classList.add('show');
};

window.closeFilterOverlay = function () {
    const overlay = document.getElementById('filterOverlay');
    if (overlay) overlay.classList.remove('show');
};

window.clearAllFilters = function () {
    activeFilters = { role: [], experience: [], daws: [] };
    document.querySelectorAll('.filter-chip.active').forEach(c => c.classList.remove('active'));
    window.applyFilters();
};

window.applyFilters = function () {
    // If on Grupos tab, switch to Principal first
    const tabPrincipal = document.getElementById('tabPrincipal');
    const tabGrupos = document.getElementById('tabGrupos');
    if (tabGrupos && tabGrupos.classList.contains('active')) {
        // Switch to Principal tab
        tabGrupos.classList.remove('active');
        if (tabPrincipal) {
            tabPrincipal.classList.add('active');
            _updateTabIndicator(tabPrincipal);
        }
    }

    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    if (!cachedData) {
        window.closeFilterOverlay();
        return;
    }

    try {
        const chats = JSON.parse(cachedData);
        let filtered = chats;

        // Apply Role filter
        if (activeFilters.role.length > 0) {
            filtered = filtered.filter(c => activeFilters.role.includes(c.role));
        }

        // Apply Experience filter
        if (activeFilters.experience.length > 0) {
            filtered = filtered.filter(c => activeFilters.experience.includes(c.experience));
        }

        // Apply DAW filter
        if (activeFilters.daws.length > 0) {
            filtered = filtered.filter(c => {
                if (!c.daws || !Array.isArray(c.daws)) return false;
                return activeFilters.daws.some(fd => c.daws.includes(fd));
            });
        }

        // Sort: pinned first, then by date
        const localPinned = JSON.parse(localStorage.getItem('offszn_pinned_chats') || '[]');
        filtered = filtered.map(c => ({ ...c, isPinned: localPinned.includes(c.id) }));
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        const listContainer = document.getElementById('conversationsList');
        if (listContainer) {
            renderConversationList(filtered, listContainer);
        }

        // Hide skeletons if still visible
        const skelDiv = document.getElementById('chatSidebarSkeletons');
        if (skelDiv) skelDiv.style.display = 'none';

        window.closeFilterOverlay();

    } catch (e) {
        console.error('Error applying filters:', e);
        window.closeFilterOverlay();
    }
};

// Initialize filter listeners on load
setTimeout(setupFilterListeners, 1000); // Small delay to ensure DOM is ready

// V14: Mandatory Initialization Finalizer (Consolidated above)
