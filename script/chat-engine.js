// ===== CHAT ENGINE - COMPLETE REWRITE =====
// Use the global client initialized by auth-utils.js
const supabase = window.supabaseClient;

// Safety check (Non-blocking log, verified in init)
if (!supabase && window.location.pathname.includes('chat')) {
    console.warn("Chat Engine: Global Supabase not found yet. It should be initialized by auth-utils.js.");
}

let currentUser = null;
let currentConversationId = null;
let emojiPicker = null;
let isInitialized = false; // Flag to prevent re-initialization

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

    console.log("💬 Chat Engine Initialized");
    // initUI(); // Assuming initUI() is defined elsewhere or will be added.

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = '/pages/login.html';
        return;
    }

    currentUser = session.user;

    // Show UI (Skeletons visible by default in HTML)
    // We wait for EVERYTHING to load before revealing text to keep it sync

    // Setup everything
    setupEventListeners();

    // CHAIN LOAD: User -> then (Conversations + Realtime)
    // or PARALLEL: User + Conversations -> then Reveal

    const p1 = loadUserProfile();
    const p2 = loadConversations({ keepSkeletons: true });
    const p3 = new Promise(resolve => setTimeout(resolve, 800)); // Reduced delay to 800ms

    // --- INSTANT PRE-FILL TRICK ---
    // Handle ?user=nickname parameter ASAP
    const urlParams = new URLSearchParams(window.location.search);
    const targetNickname = urlParams.get('user');
    const initialMsg = urlParams.get('msg');
    const directConvId = urlParams.get('convId');

    if (targetNickname) {
        // Find target user but don't AWAIT yet for the UI reveal
        const targetPromise = supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('nickname', targetNickname)
            .single();

        targetPromise.then(async ({ data: targetUser, error }) => {
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
        // Handle direct conversation link ASAP
        const directPromise = supabase
            .from('conversation_participants')
            .select('conversation_id, user_id')
            .eq('conversation_id', directConvId)
            .neq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();

        directPromise.then(async ({ data: participation, error }) => {
            if (participation && !error) {
                const { data: targetUser } = await supabase
                    .from('users')
                    .select('id, nickname, avatar_url')
                    .eq('id', participation.user_id)
                    .single();

                if (targetUser) {
                    openChat(directConvId, targetUser.nickname, targetUser.avatar_url, targetUser.id);
                }
            }
        });
    }

    await Promise.all([p1, p2, p3]);

    // SYNC REVEAL: All data is ready
    finalizeGlobalLoading();

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

    // Search
    const searchInput = document.querySelector('.search-input-wrapper input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => handleUserSearch(e.target.value), 300);
        });
    }

    // Tab buttons
    const tabPrincipal = document.getElementById('tabPrincipal');
    const tabSolicitudes = document.getElementById('tabSolicitudes');
    const searchInputEl = document.querySelector('.search-input-wrapper input'); // Grab input ref

    if (tabPrincipal && tabSolicitudes) {
        tabPrincipal.addEventListener('click', () => {
            if (tabPrincipal.classList.contains('active')) return; // ignore if already active
            tabPrincipal.classList.add('active');
            tabSolicitudes.classList.remove('active');

            // Enable search
            if (searchInputEl) {
                searchInputEl.disabled = false;
                searchInputEl.style.opacity = '1';
                searchInputEl.placeholder = 'Buscar';
            }

            loadConversations();
        });
        tabSolicitudes.addEventListener('click', () => {
            if (tabSolicitudes.classList.contains('active')) return;
            tabSolicitudes.classList.add('active');
            tabPrincipal.classList.remove('active');

            // Disable search
            if (searchInputEl) {
                searchInputEl.disabled = true;
                searchInputEl.style.opacity = '0.5';
                searchInputEl.placeholder = 'No disponible';
                searchInputEl.value = ''; // Clear search
            }

            showSolicitudes();
        });
    }

    // Edit button (Pencil)
    const editBtn = document.querySelector('.sidebar-header .action-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }

    // Emoji picker
    setupEmojiPicker();
}

let isEditMode = false;
function toggleEditMode() {
    isEditMode = !isEditMode;
    const items = document.querySelectorAll('.chat-item');
    items.forEach(item => {
        let delBtn = item.querySelector('.delete-chat-btn');
        if (isEditMode) {
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
            if (delBtn) delBtn.style.display = 'none';
        }
    });
}

async function deleteConversation(convId) {
    if (!convId) return;
    const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', convId)
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('Error deleting conversation:', error);
        alert('Error al eliminar chat');
    } else {
        if (currentConversationId === convId) {
            currentConversationId = null;
            document.getElementById('activeChatContainer').style.display = 'none';
            document.getElementById('chatPlaceholder').style.display = 'flex';
            localStorage.removeItem('OFFSZN_LAST_CONV_ID');
        }
        loadConversations();
    }
}

function showSolicitudes() {
    const listContainer = document.getElementById('conversationsList');
    listContainer.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #666;">
            <i class="bi bi-person-plus" style="font-size: 3rem; display: block; margin-bottom: 10px; opacity: 0.3;"></i>
            <p>Aún no tienes solicitudes</p>
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
        .insert({ is_group: false })
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
        // Store for finalize step
        window.tempUserName = myName;
    } catch (e) {
        window.tempUserName = 'Usuario';
    }
}

function finalizeGlobalLoading() {
    // 1. Reveal Username
    const nameEl = document.getElementById('chatMyUsername');
    if (nameEl && window.tempUserName) nameEl.innerText = window.tempUserName;

    // 2. Reveal Tabs
    const tabP = document.getElementById('tabPrincipal');
    const tabS = document.getElementById('tabSolicitudes');
    if (tabP) tabP.innerText = 'Principal';
    if (tabS) tabS.innerText = 'Solicitudes';

    // 3. Hide Sidebar Skeletons (List)
    const skels = document.getElementById('chatSidebarSkeletons');
    if (skels) skels.style.display = 'none';

    // 4. Reveal Placeholder Content (Main Area)
    revealPlaceholderContent();

    // 5. REMOVE GLOBAL LOADER OVERLAY
    const loader = document.getElementById('chatGlobalLoader');
    if (loader) {
        loader.style.transition = 'opacity 0.5s ease';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 550);
    }
}

// ===== LOAD CONVERSATIONS =====
async function loadConversations(opts = {}) {
    // opts.keepSkeletons = true means we simply fetch data but don't touch the DOM skeletons yet
    // because finalizeGlobalLoading will handle the "big reveal"

    // RACE CONDITION CHECK: Only load if Principal is active
    const tabPrincipal = document.getElementById('tabPrincipal');
    if (!tabPrincipal || !tabPrincipal.classList.contains('active')) return;

    const listContainer = document.getElementById('conversationsList');

    // Check if we are already showing real content or just starting
    // If we have skeletons (first load), we don't clear them immediately to avoid flickering
    // but we will replace them once we have data.

    // 0. CACHING STRATEGY (Instant Load)
    const cachedData = localStorage.getItem('OFFSZN_CHATS_CACHE');
    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            if (cache && cache.length > 0) {
                renderConversationList(cache, listContainer);
                // Hide skeletons immediately if we have cache
                const skeletons = document.getElementById('chatSidebarSkeletons');
                if (skeletons) skeletons.style.display = 'none';
            }
        } catch (e) { console.error('Cache parse error', e); }
    }

    // 1. Get all conversations I am part of
    const { data: participations, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

    if (!participations || participations.length === 0) {
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

    // 3. Get all other users' profiles in one go
    const { data: profiles } = await supabase
        .from('users')
        .select('id, nickname, avatar_url')
        .in('id', otherUserIds);

    const profileMap = {};
    profiles.forEach(p => profileMap[p.id] = p);

    // 4. Get the last message for each conversation
    // (Still hard to do in one query without a view, but we'll use a Promise.all)
    const lastMsgsPromises = conversationIds.map(cid =>
        supabase.from('messages')
            .select('content, attachment_url, created_at')
            .eq('conversation_id', cid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
    );
    const lastMsgResults = await Promise.all(lastMsgsPromises);
    const lastMsgMap = {};
    lastMsgResults.forEach((res, idx) => {
        if (res.data) lastMsgMap[conversationIds[idx]] = res.data;
    });

    // 5. Get conversations ordered by updated_at
    const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

    listContainer.innerHTML = '';

    // Prepare data for rendering and cache
    const chatsToRender = [];

    conversations.forEach(conv => {
        const otherParticipancy = allParticipants.find(p => p.conversation_id === conv.id);
        if (!otherParticipancy) return;

        const profile = profileMap[otherParticipancy.user_id];
        const name = profile?.nickname || 'Usuario';
        const avatar = profile?.avatar_url || null;
        const userId = otherParticipancy.user_id;

        const lastMsgObj = lastMsgMap[conv.id];
        let lastMsg = 'Empezar conversación';
        let created_at = conv.updated_at; // Fallback

        if (lastMsgObj) {
            created_at = lastMsgObj.created_at;
            if (lastMsgObj.content) {
                lastMsg = lastMsgObj.content;
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
            userId
        });
    });

    // Save to Cache
    localStorage.setItem('OFFSZN_CHATS_CACHE', JSON.stringify(chatsToRender));

    // Render Fresh Data
    renderConversationList(chatsToRender, listContainer);

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

function renderConversationList(chats, container) {
    const tabPrincipal = document.getElementById('tabPrincipal');
    if (tabPrincipal && !tabPrincipal.classList.contains('active')) {
        console.warn("Attempted to render conversation list while on Solicitudes tab. Blocked.");
        return;
    }
    container.innerHTML = '';

    // Safety check for skeletons container if it was cleared
    // Actually we just clear everything so skeletons are gone

    if (chats.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No tienes mensajes aún.</div>';
        return;
    }

    chats.forEach(chat => {
        const timeAgoStr = formatTime(chat.created_at);

        const div = document.createElement('div');
        div.className = 'chat-item';
        div.setAttribute('data-id', chat.id);
        div.onclick = () => openChat(chat.id, chat.name, chat.avatar, chat.userId);

        // Highlight if active
        if (currentConversationId === chat.id) div.classList.add('active');

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-avatar';
        avatarDiv.innerHTML = renderAvatar(chat.avatar, chat.name);

        const nameDiv = document.createElement('div');
        nameDiv.className = 'chat-name';
        nameDiv.textContent = chat.name;

        const previewDiv = document.createElement('div');
        previewDiv.className = 'chat-preview';
        previewDiv.textContent = `${chat.lastMsg} • ${timeAgoStr}`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'chat-info';
        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(previewDiv);

        div.appendChild(avatarDiv);
        div.appendChild(infoDiv);
        container.appendChild(div);
    });
}

// ===== OPEN CHAT (UPDATED) =====
async function openChat(convId, name, avatar, userId) {
    currentConversationId = convId;
    localStorage.setItem('OFFSZN_LAST_CONV_ID', convId);

    // 4. Update Header
    const placeholder = document.getElementById('chatPlaceholder');
    const activeCont = document.getElementById('activeChatContainer');

    // Hide all skeletons if any
    const mainSkeleton = document.getElementById('chatMainSkeleton');
    if (mainSkeleton) mainSkeleton.style.display = 'none';

    if (placeholder) placeholder.style.display = 'none';
    activeCont.style.display = 'flex';

    // Update active state in sidebar
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-id') === convId);
    });

    // Update header
    let roleText = '';
    let socials = {};

    if (userId) {
        const { data: userDetails } = await supabase
            .from('users')
            .select('role, is_producer, socials')
            .eq('id', userId)
            .single();

        if (userDetails) {
            if (userDetails.is_producer) {
                roleText = "PRODUCTOR MUSICAL";
            } else if (userDetails.role && userDetails.role !== 'user') {
                roleText = userDetails.role.toUpperCase();
            }
            socials = userDetails.socials || {};
            if (typeof socials === 'string') {
                try { socials = JSON.parse(socials); } catch (e) { socials = {}; }
            }
        }
    }

    const nameEl = document.getElementById('currentChatName');
    nameEl.textContent = name;
    nameEl.style.cursor = 'pointer';
    nameEl.onclick = () => window.location.href = `/@${name}`;

    const avatarEl = document.getElementById('currentChatAvatar');
    avatarEl.innerHTML = renderAvatar(avatar, name);
    avatarEl.style.cursor = 'pointer';
    avatarEl.onclick = () => window.location.href = `/@${name}`;

    document.getElementById('currentChatStatus').textContent = roleText;

    // RENDER SOCIALS IN HEADER
    const actionsContainer = document.querySelector('.chat-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';
        const icons = {
            instagram: 'bi-instagram',
            youtube: 'bi-youtube',
            tiktok: 'bi-tiktok',
            spotify: 'bi-spotify',
            twitter: 'bi-twitter-x'
        };

        const socialGroup = document.createElement('div');
        socialGroup.className = 'header-socials';

        Object.keys(socials).forEach(key => {
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
                a.className = 'header-social-link';
                a.innerHTML = `<i class="bi ${icons[k]}"></i>`;
                socialGroup.appendChild(a);
            }
        });
        actionsContainer.appendChild(socialGroup);
    }

    const feedInner = document.getElementById('messagesFeedInner');
    feedInner.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Cargando mensajes...</div>';

    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

    feedInner.innerHTML = '';
    if (messages) {
        messages.forEach(msg => renderMessage(msg));
    }
    scrollToBottom();
}

// ===== SEND MESSAGE =====
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !currentConversationId) return;

    input.value = '';

    // Optimistic UI for chat bubble
    renderMessage({
        sender_id: currentUser.id,
        content: text,
        created_at: new Date().toISOString()
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
        content: text
    }).select().single();

    if (error) {
        console.error('Error sending message:', error);
        return;
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
    const isMe = msg.sender_id === currentUser.id;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMe ? 'sent' : 'received'}`;

    if (msg.content) {
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';

        // Linkify URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const htmlContent = msg.content.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`;
        });

        bubbleDiv.innerHTML = htmlContent;
        messageDiv.appendChild(bubbleDiv);
    }

    if (msg.attachment_url && msg.attachment_type === 'image') {
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.style.padding = '4px';
        bubbleDiv.style.background = 'transparent';

        const img = document.createElement('img');
        img.src = msg.attachment_url;
        img.style.maxHeight = '250px';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '12px';
        img.style.cursor = 'pointer';
        img.style.display = 'block';
        img.onclick = () => window.open(msg.attachment_url, '_blank');

        bubbleDiv.appendChild(img);
        messageDiv.appendChild(bubbleDiv);
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(msg.created_at);
    messageDiv.appendChild(timeDiv);

    feedInner.appendChild(messageDiv);
}

// ===== HELPERS =====
function renderAvatar(url, name) {
    if (url && url.length > 10) {
        return `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }
    const initial = (name || 'U').charAt(0).toUpperCase();
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
                    renderMessage(payload.new);
                    scrollToBottom();

                    const item = document.querySelector(`.chat-item[data-id="${currentConversationId}"]`);
                    if (item) {
                        const preview = item.querySelector('.chat-preview');
                        const text = payload.new.content || '📷 Foto';
                        const short = text.length > 25 ? text.substring(0, 22) + '...' : text;
                        if (preview) preview.textContent = `${short} • Ahora`;

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
                        if (preview) preview.textContent = `${short} • Ahora`;
                        const list = document.getElementById('conversationsList');
                        if (list) list.prepend(item);
                    } else {
                        loadConversations();
                    }
                }
            }
        })
        .subscribe();
}


// ===== MODAL LOGIC (New Message) =====

let selectedUserForChat = null;

window.openNewMessageModal = function () {
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

window.closeNewMessageModal = function (e) {
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
        <div class="modal-skeleton-item"><div class="modal-skeleton-avatar"></div><div class="modal-skeleton-line"></div></div>
        <div class="modal-skeleton-item"><div class="modal-skeleton-avatar"></div><div class="modal-skeleton-line"></div></div>
        <div class="modal-skeleton-item"><div class="modal-skeleton-avatar"></div><div class="modal-skeleton-line"></div></div>
    `;

    let dbQuery = supabase
        .from('users')
        .select('id, nickname, avatar_url, first_name, last_name')
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
        const initial = u.nickname.charAt(0).toUpperCase();

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
                <div class="chat-modal-username">${u.nickname}</div>
                <div class="chat-modal-fullname">${u.first_name || ''} ${u.last_name || ''}</div>
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

window.startChatFromModal = async function () {
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

