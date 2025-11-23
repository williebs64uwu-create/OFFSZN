document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');
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
    let currentConversationData = null; // Guardar datos como nombre/avatar
    let selectedFile = null;
    let currentAudio = null;
    let audioUpdateInterval = null;

    // --- ELEMENTOS DOM ---
    const listContainer = document.getElementById('conversationsList');
    const chatArea = document.getElementById('chatArea');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
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
            listContainer.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Error cargando conversaciones.</p>';
        }
    }

    async function loadMessages(convId) {
        try {
            chatArea.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Cargando mensajes...</div>';
            
            const res = await fetch(`${API_URL}/chat/conversations/${convId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messages = await res.json();
            
            // Encontrar datos de la conversación actual para el header
            const convData = conversations.find(c => c.id == convId);
            currentConversationData = convData;
            currentConversationId = convId;

            renderChatArea(messages, convData);

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

    // Función puente para el onclick del HTML generado
    window.selectConversation = (id) => {
        loadMessages(id);
        // Actualizar visualmente la lista para marcar activo
        document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
        // (El rerender completo ocurre en loadMessages -> renderChatArea, pero esto da feedback instantáneo)
    };

    function renderChatArea(messages, convData) {
        // Avatar gradient determinístico basado en ID
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
                    <div class="chat-input-actions">
                        <button class="input-action-btn" onclick="alert('Pronto: Subida de archivos')"><i class="fas fa-paperclip"></i></button>
                        <button class="input-action-btn" onclick="toggleEmojiPicker()"><i class="fas fa-smile"></i></button>
                    </div>
                    <div class="chat-input-field">
                        <textarea id="messageInput" placeholder="Escribe un mensaje..." rows="1"></textarea>
                    </div>
                    <button class="send-btn" id="sendBtn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        // Re-attachear eventos del input nuevo
        const input = document.getElementById('messageInput');
        const btn = document.getElementById('sendBtn');
        
        input.addEventListener('input', () => {
            btn.disabled = !input.value.trim();
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        btn.addEventListener('click', handleSendMessage);

        // Scroll al fondo
        const msgContainer = document.getElementById('chatMessages');
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    function renderMessagesList(messages) {
        if (messages.length === 0) return '<div class="date-divider"><span>Inicio de la charla</span></div>';

        return messages.map(msg => {
            const isMe = msg.sender === 'me';
            // Si es 'me', usamos un gradiente fijo o del usuario, si es 'other', usamos el de la conversación
            const gradient = isMe ? 'avatar-gradient-4' : `avatar-gradient-${(currentConversationId % 5) + 1}`;
            const avatarLetter = isMe ? 'YO' : currentConversationData.avatar;

            let contentHtml = `<div class="message-bubble"><div class="message-text">${msg.text}</div></div>`;
            
            // Soporte básico para tipos (expandiremos audio/imagen luego)
            if (msg.type === 'audio') {
                contentHtml = `<div class="audio-preview">Audio (Pronto)</div>`;
            }

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

        try {
            // Limpiar input visualmente rápido
            input.value = ''; 
            
            // Enviar a API
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

            // Recargar mensajes (Polling simple por ahora)
            // Idealmente aquí agregaríamos el mensaje al DOM manualmente para sensación instantánea
            await loadMessages(currentConversationId);

        } catch (err) {
            console.error(err);
            alert('Error enviando mensaje');
        }
    }

    // ============================================================
    // 4. INICIALIZACIÓN
    // ============================================================
    
    // Exponer funciones globales necesarias para el HTML (onclicks)
    window.toggleEmojiPicker = () => {
        const picker = document.getElementById('emojiPicker');
        if(picker) picker.classList.toggle('active');
    };
    
    // Cargar lista inicial
    loadConversations();
    
    // Polling para actualizar lista de conversaciones (cada 10s)
    setInterval(loadConversations, 10000);
});