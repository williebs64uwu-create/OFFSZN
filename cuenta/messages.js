document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
    
    // 1. CONFIGURACIÓN SUPABASE (Tus credenciales públicas)
    const SUPABASE_URL = "https://qtjpvztpgfymjhhpoouq.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
    
    // Inicializar cliente Supabase solo para escuchar
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Configuración API Backend
    let API_URL = window.location.hostname.includes('localhost') 
        ? 'http://localhost:3000/api' 
        : 'https://offszn-academy.onrender.com/api';

    if (!token) {
        window.location.replace('/pages/login.html');
        return;
    }

    // --- ESTADO GLOBAL ---
    let conversations = [];
    let currentConversationId = null;
    let currentConversationData = null;
    let activeSubscription = null; // Para guardar la suscripción actual
    let currentUserId = null; // Necesitamos saber quién soy para alinear mensajes

    // --- OBTENER MI USER ID (Decodificando token o del localStorage) ---
    // Esto es vital para saber si el mensaje nuevo es "mío" (derecha) o "tuyo" (izquierda)
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        currentUserId = payload.userId || payload.sub; // Ajusta según tu JWT
    } catch (e) { console.error("Error decodificando token", e); }


    // --- ELEMENTOS DOM ---
    const listContainer = document.getElementById('conversationsList');
    const chatArea = document.getElementById('chatArea');
    
    // ============================================================
    // 0. LÓGICA REALTIME (LA MAGIA) ✨
    // ============================================================
    function subscribeToConversation(convId) {
        // 1. Si ya escuchábamos otro chat, nos desuscribimos para no mezclar
        if (activeSubscription) {
            supabase.removeChannel(activeSubscription);
            activeSubscription = null;
        }

        console.log(`🔌 Suscribiéndose al chat: ${convId}`);

        // 2. Crear nueva suscripción
        activeSubscription = supabase
            .channel(`chat_room_${convId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT', // Solo escuchar nuevos mensajes
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${convId}`
                },
                (payload) => {
                    console.log('⚡ ¡Nuevo mensaje recibido en tiempo real!', payload);
                    handleNewRealtimeMessage(payload.new);
                }
            )
            .subscribe();
    }

    function handleNewRealtimeMessage(msgRow) {
        // Si el mensaje lo envié yo, el Optimistic UI ya lo mostró, así que lo ignoramos
        // para no duplicarlo (o podríamos actualizar su estado a "leído")
        if (msgRow.sender_id === currentUserId) {
            console.log("Ignorando mensaje propio (ya mostrado por Optimistic UI)");
            return;
        }

        // Formatear el mensaje crudo de la BD al formato que usa tu UI
        const formattedMsg = {
            id: msgRow.id,
            sender: 'other', // Si llegó por realtime y no soy yo, es 'other'
            text: msgRow.content,
            type: msgRow.type,
            time: new Date(msgRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            avatar: currentConversationData ? currentConversationData.avatar : '?',
            gradient: `avatar-gradient-${(currentConversationId % 5) + 1}`
        };

        // Inyectar HTML
        const container = document.getElementById('chatMessages');
        if (container) {
            // Usamos tu función renderMessagesList pero adaptada para un solo item
            // O inyectamos directamente el HTML del mensaje
            const html = `
                <div class="message-group slide-in-bottom">
                    <div class="message-avatar ${formattedMsg.gradient}">${formattedMsg.avatar}</div>
                    <div class="message-content">
                        <div class="message-bubble"><div class="message-text">${formattedMsg.text}</div></div>
                        <div class="message-time">${formattedMsg.time}</div>
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', html);
            container.scrollTop = container.scrollHeight; // Auto scroll
            
            // Reproducir sonido de notificación suave (opcional)
            // playNotificationSound();
        }
    }

    // ============================================================
    // 1. CARGA DE DATOS
    // ============================================================

    async function loadConversations() {
        try {
            const res = await fetch(`${API_URL}/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error cargando chats');
            
            conversations = await res.json();
            renderConversationsList(conversations);
            
        } catch (err) {
            console.error(err);
        }
    }

    async function loadMessages(convId) {
        try {
            if (currentConversationId != convId) {
                chatArea.innerHTML = '<div style="padding:20px; text-align:center; color:#666;"><i class="fas fa-spinner fa-spin"></i> Cargando chat...</div>';
            }

            const res = await fetch(`${API_URL}/chat/conversations/${convId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messages = await res.json();
            
            const convData = conversations.find(c => c.id == convId);
            const messagesContainer = document.getElementById('chatMessages');
            
            if (currentConversationId == convId && messagesContainer) {
                messagesContainer.innerHTML = renderMessagesList(messages);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                currentConversationData = convData;
                currentConversationId = convId;
                renderChatArea(messages, convData);
            }

            // ✅ ACTIVAR REALTIME PARA ESTE CHAT
            subscribeToConversation(convId);

        } catch (err) {
            console.error(err);
        }
    }

    // ============================================================
    // 2. RENDERIZADO (UI)
    // ============================================================

    function renderConversationsList(list) {
        if (list.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: #333; margin-bottom: 16px;"></i>
                    <p style="color: #666;">No tienes conversaciones iniciadas.</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = list.map(conv => `
            <div class="conversation-item ${conv.id == currentConversationId ? 'active' : ''}" onclick="selectConversation(${conv.id})">
                <div class="conversation-avatar avatar-gradient-${(conv.id % 5) + 1}">
                    ${conv.avatar}
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${conv.name}</div>
                    <div class="conversation-message">${conv.lastMessage}</div>
                </div>
                <div class="conversation-time">${conv.time}</div>
            </div>
        `).join('');
    }

    window.selectConversation = (id) => {
        loadMessages(id);
        document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    };

    function renderChatArea(messages, convData) {
        const gradientClass = `avatar-gradient-${(convData.id % 5) + 1}`;

        chatArea.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-header-avatar ${gradientClass}">${convData.avatar}</div>
                    <div class="chat-header-details">
                        <h3>${convData.name}</h3>
                        <div class="chat-header-status online">En línea</div>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button class="chat-action-btn"><i class="fas fa-info-circle"></i></button>
                </div>
            </div>

            <div class="chat-messages" id="chatMessages">
                ${renderMessagesList(messages)}
            </div>

            <div class="chat-input-container">
                <div class="chat-input-wrapper">
                    <div class="chat-input-field">
                        <textarea id="messageInput" placeholder="Escribe un mensaje..." rows="1"></textarea>
                    </div>
                    <button class="send-btn" id="sendBtn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        const input = document.getElementById('messageInput');
        const btn = document.getElementById('sendBtn');
        
        input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
        btn.addEventListener('click', handleSendMessage);

        const msgContainer = document.getElementById('chatMessages');
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function renderMessagesList(messages) {
        if (messages.length === 0) return '<div class="date-divider"><span>Inicio de la charla</span></div>';

        return messages.map(msg => {
            const isMe = msg.sender === 'me';
            const gradient = isMe ? 'avatar-gradient-4' : `avatar-gradient-${(currentConversationId % 5) + 1}`;
            const avatarLetter = isMe ? 'YO' : currentConversationData.avatar;

            let contentHtml = `<div class="message-bubble"><div class="message-text">${msg.text}</div></div>`;
            
            return `
                <div class="message-group ${isMe ? 'sent' : ''}">
                    <div class="message-avatar ${gradient}">${avatarLetter}</div>
                    <div class="message-content">
                        ${contentHtml}
                        <div class="message-time">${msg.time}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================================
    // 3. ACCIONES (ENVIAR)
    // ============================================================

    async function handleSendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !currentConversationId) return;

        // UI OPTIMISTA
        const tempId = Date.now();
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const optimisticHTML = `
            <div class="message-group sent" id="msg-${tempId}" style="opacity: 0.7;"> 
                <div class="message-avatar avatar-gradient-4">YO</div>
                <div class="message-content">
                    <div class="message-bubble" style="background: #8b5cf6;">
                        <div class="message-text" style="color: #fff;">${text}</div>
                    </div>
                    <div class="message-time">${timeNow}</div>
                </div>
            </div>
        `;

        const container = document.getElementById('chatMessages');
        container.insertAdjacentHTML('beforeend', optimisticHTML);
        container.scrollTop = container.scrollHeight;
        
        input.value = '';
        document.getElementById('sendBtn').disabled = true;

        try {
            // ENVIAR AL SERVIDOR
            const res = await fetch(`${API_URL}/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    conversationId: currentConversationId,
                    content: text,
                    type: 'text'
                })
            });

            if (!res.ok) throw new Error('Falló el envío');

            // Confirmar visualmente
            const tempMsg = document.getElementById(`msg-${tempId}`);
            if (tempMsg) tempMsg.style.opacity = '1';

        } catch (err) {
            console.error(err);
            const tempMsg = document.getElementById(`msg-${tempId}`);
            if (tempMsg) {
                tempMsg.style.opacity = '1';
                tempMsg.querySelector('.message-bubble').style.background = '#ef4444';
                alert('No se pudo enviar el mensaje.');
            }
        }
    }

    // ============================================================
    // 4. INICIALIZACIÓN
    // ============================================================
    
    loadConversations();
    // Actualizamos la lista de chats cada 15s (no los mensajes, eso va por realtime)
    setInterval(loadConversations, 15000);
});