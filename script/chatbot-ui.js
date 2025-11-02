document.addEventListener('DOMContentLoaded', () => {

    const chatIcon = document.getElementById('chatIcon');
    const chatWindow = document.getElementById('chatWindow');
    const chatMenu = document.getElementById('chatMenu'); 
    const closeChat = document.getElementById('closeChat'); 
    const closeMenuButton = document.getElementById('closeMenuButton'); 
    const startChatButton = document.getElementById('startChatButton'); 
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');
    const chatBody = document.getElementById('chatBody');
    const predefinedQuestions = document.querySelectorAll('.predefined-question'); 

    chatIcon.addEventListener('click', () => {
        chatMenu.classList.toggle('open'); 
        chatWindow.classList.remove('open'); 
    });

    closeChat.addEventListener('click', () => {
        chatWindow.classList.remove('open');
        chatMenu.classList.add('open'); 
    });

    closeMenuButton.addEventListener('click', () => {
        chatMenu.classList.remove('open'); 
    });

    startChatButton.addEventListener('click', () => {
        chatMenu.classList.remove('open'); 
        chatWindow.classList.add('open');   
        chatInput.focus(); 
    });

    sendButton.addEventListener('click', () => {
        sendMessage();
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    predefinedQuestions.forEach(button => {
        button.addEventListener('click', () => {
            const questionText = button.textContent.trim();
            chatInput.value = questionText; 
            chatMenu.classList.remove('open');
            chatWindow.classList.add('open');
            sendMessage(); 
        });
    });


    async function sendMessage() {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;

        addMessageToChat('user', messageText);
        chatInput.value = '';

        try {
            addMessageToChat('bot', 'Escribiendo...');

            const response = await fetch('/api/chat', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: messageText }), 
            });

            if (!response.ok) {
                throw new Error('La respuesta del servidor no fue OK');
            }

            const data = await response.json();
            const botResponse = data.text;

            removeLastBotMessage();
            addMessageToChat('bot', botResponse);

        } catch (error) {
            console.error('Error al llamar a la API:', error);
            removeLastBotMessage();
            addMessageToChat('bot', 'Lo siento, algo salió mal. Por favor, intenta de nuevo.');
        }
    }

    
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m];
        });
    }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>');
    }

    function addMessageToChat(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);

        if (sender === 'bot') {
            let safeText = escapeHTML(text);
            let linkedText = linkify(safeText);
            messageElement.innerHTML = linkedText;
        } else {
            messageElement.textContent = text;
        }

        chatBody.appendChild(messageElement);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function removeLastBotMessage() {
        const lastMessage = chatBody.querySelector('.message.bot:last-child');
        if (lastMessage && lastMessage.textContent === 'Escribiendo...') {
            chatBody.removeChild(lastMessage);
        }
    }
});