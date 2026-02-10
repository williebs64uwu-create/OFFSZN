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
let isInitialized = false;
let replyToId = null; // State for current reply

// ===== GLOBAL EXPORTS (For HTML onclicks) =====
window.onReplyClick = onReplyClick;
window.cancelReply = cancelReply;
window.onReactClick = onReactClick;
window.submitReaction = submitReaction;
window.scrollToMessage = scrollToMessage;
window.openNewMessageModal = openNewMessageModal;
window.closeNewMessageModal = closeNewMessageModal;
window.startChatFromModal = startChatFromModal;
window.toggleMessageMenu = toggleMessageMenu;
window.copyMessageText = copyMessageText;

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
    const searchInputEl = document.querySelector('.search-input-wrapper input');

    if (tabPrincipal && tabSolicitudes) {
        tabPrincipal.onclick = () => {
            if (tabPrincipal.classList.contains('active')) return;
            tabPrincipal.classList.add('active');
            tabSolicitudes.classList.remove('active');
            if (searchInputEl) {
                searchInputEl.disabled = false;
                searchInputEl.parentElement.style.opacity = '1';
                searchInputEl.placeholder = 'Buscar';
            }
            loadConversations();
        };
        tabSolicitudes.onclick = () => {
            if (tabSolicitudes.classList.contains('active')) return;
            tabSolicitudes.classList.add('active');
            tabPrincipal.classList.remove('active');
            if (searchInputEl) {
                searchInputEl.disabled = true;
                searchInputEl.parentElement.style.opacity = '0.5';
                searchInputEl.placeholder = 'Solo Principal';
                searchInputEl.value = '';
            }
            showSolicitudes();
        };
    }

    // Edit button (Pencil)
    const editBtn = document.querySelector('.sidebar-header .action-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
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
    cancelReply(); // FIX: Clear any lingering reply preview
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
        .select(`
            *, 
            message_reactions(user_id, emoji),
            parent:messages!reply_to_id(
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
    scrollToBottom();
}

// ===== SEND MESSAGE =====
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !currentConversationId) return;

    input.value = '';

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

    // 2. REPLY PREVIEW
    let replyHtml = '';
    // Handle array or object return from Supabase
    const parentMsg = Array.isArray(msg.parent) ? msg.parent[0] : msg.parent;

    if (parentMsg) {
        const pContent = parentMsg.content || (parentMsg.attachment_type === 'image' ? '📷 Foto' : '');

        if (pContent) {
            const shortReply = pContent.length > 50 ? pContent.substring(0, 47) + '...' : pContent;
            const pIsMe = parentMsg.sender_id === currentUser.id;

            // Current sender name (for received headers)
            const senderData = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
            const senderNick = senderData?.nickname || 'Usuario';

            // Parent sender name
            const parentSenderData = Array.isArray(parentMsg.sender) ? parentMsg.sender[0] : parentMsg.sender;
            const parentNick = parentSenderData?.nickname || 'Usuario';

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
            <button class="msg-action-btn" onclick="onReplyClick('${msg.id}', '${isMe ? 'Tú' : 'Usuario'}', '${msg.content?.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" ${!msg.id ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
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
            reactionHtml = `<div class="message-reaction-bubble" onclick="submitReaction('${msg.id}', '${displayEmoji}', event)">${displayEmoji}</div>`;
        }
    }

    // 4. CONTENT - CONTENT
    let contentHtml = '';
    if (msg.attachment_url && msg.attachment_type === 'image') {
        contentHtml = `<img src="${msg.attachment_url}" style="max-height: 250px; border-radius: 12px; cursor: pointer; display: block;" onclick="window.open('${msg.attachment_url}', '_blank')">`;
    } else {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const rawContent = msg.content || '';
        contentHtml = rawContent.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`);
    }

    // Structure matches Image 2 and modern chat apps
    const senderData = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
    const avatarHtml = !isMe ? `
        <div class="oz-msg-avatar">
            ${renderAvatar(senderData?.avatar_url, senderData?.nickname)}
        </div>
    ` : '';

    msgDiv.innerHTML = `
        ${avatarHtml}
        <div class="oz-msg-body">
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
            message_reactions(user_id, emoji),
            parent:messages!reply_to_id(
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

