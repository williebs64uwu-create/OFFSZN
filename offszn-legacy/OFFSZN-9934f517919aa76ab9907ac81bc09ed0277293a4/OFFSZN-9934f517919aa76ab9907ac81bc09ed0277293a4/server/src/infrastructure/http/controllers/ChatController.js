import { supabase } from '../../database/connection.js';

// 1. OBTENER CONVERSACIONES DEL USUARIO
export const getConversations = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Buscamos conversaciones donde el usuario sea participant_1 o participant_2
        const { data: conversations, error } = await supabase
            .from('conversations')
            .select(`
        *,
        p1:users!conversations_participant_1_fkey (id, nickname, first_name, last_name, avatar_url),
        p2:users!conversations_participant_2_fkey (id, nickname, first_name, last_name, avatar_url)
    `)
            .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Formateamos para que el frontend reciba datos limpios
        const formatted = conversations.map(c => {
            // Identificar quién es el "otro" usuario
            const otherUser = c.participant_1 === userId ? c.p2 : c.p1;
            // Si el usuario no tiene datos (ej. borrado), ponemos placeholder
            const otherUserData = otherUser || { nickname: 'Usuario Desconocido' };

            return {
                id: c.id,
                name: otherUserData.nickname || `${otherUserData.first_name} ${otherUserData.last_name}`,
                avatar: (otherUserData.nickname || 'U').charAt(0).toUpperCase(),
                otherUserId: otherUserData.id, // Útil para saber con quién hablas
                lastMessage: c.last_message || 'Inicia la conversación',
                time: new Date(c.updated_at).toLocaleDateString(),
                unread: false // Por ahora simple
            };
        });

        res.status(200).json(formatted);

    } catch (err) {
        console.error("Error getConversations:", err);
        res.status(500).json({ error: 'Error al cargar conversaciones' });
    }
};

// 2. OBTENER MENSAJES DE UNA CONVERSACIÓN
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Formateamos para el frontend
        const formatted = messages.map(m => ({
            id: m.id,
            sender: m.sender_id === req.user.userId ? 'me' : 'other',
            text: m.content,
            type: m.type, // 'text', 'audio', 'image'
            mediaSrc: m.media_url, // URL del archivo si existe
            audioSrc: m.type === 'audio' ? m.media_url : null,
            imageSrc: m.type === 'image' ? m.media_url : null,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            avatar: 'U' // Placeholder, el front ya sabe qué avatar poner
        }));

        res.status(200).json(formatted);

    } catch (err) {
        console.error("Error getMessages:", err);
        res.status(500).json({ error: 'Error al cargar mensajes' });
    }
};

// 3. ENVIAR MENSAJE
export const sendMessage = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { conversationId, content, type = 'text', mediaUrl } = req.body;

        if (!conversationId || (!content && !mediaUrl)) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        // 1. Insertar mensaje
        const { data: msg, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: userId,
                content: content || '',
                type: type,
                media_url: mediaUrl
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Actualizar "último mensaje" en la conversación
        await supabase
            .from('conversations')
            .update({
                last_message: type === 'text' ? content : `Envió un ${type}`,
                updated_at: new Date()
            })
            .eq('id', conversationId);

        res.status(201).json(msg);

    } catch (err) {
        console.error("Error sendMessage:", err);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
};

// 4. CREAR/INICIAR CONVERSACIÓN (Para cuando le das "Contactar" en un perfil)
export const startConversation = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { targetUserId } = req.body; // ID del usuario con quien quieres hablar

        if (!targetUserId) return res.status(400).json({ error: 'ID de usuario requerido' });

        // Verificar si ya existe una conversación entre estos dos
        const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant_1.eq.${userId},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${userId})`)
            .maybeSingle();

        if (existing) {
            return res.status(200).json({ id: existing.id, message: 'Conversación existente' });
        }

        // Si no existe, crearla
        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
                participant_1: userId,
                participant_2: targetUserId,
                last_message: 'Nueva conversación iniciada'
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ id: newConv.id, message: 'Conversación creada' });

    } catch (err) {
        console.error("Error startConversation:", err);
        res.status(500).json({ error: 'Error al iniciar chat' });
    }
};