import { Router } from 'express';
import { authenticateTokenMiddleware } from '../../middlewares/authenticateTokenMiddleware.js';
import { 
    getConversations, 
    getMessages, 
    sendMessage, 
    startConversation 
} from '../controllers/ChatController.js';

const router = Router();

router.use(authenticateTokenMiddleware); // Todo requiere login

router.get('/chat/conversations', getConversations);
router.get('/chat/conversations/:conversationId/messages', getMessages);
router.post('/chat/messages', sendMessage);
router.post('/chat/start', startConversation);

export default router;