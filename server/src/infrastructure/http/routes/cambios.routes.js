import express from 'express';
import { cambiosAuth, getState, createItem, updateItem, deleteItem, postFeed } from '../controllers/CambiosController.js';

const router = express.Router();
router.use(cambiosAuth);
router.get('/state', getState);
router.post('/items', createItem);
router.patch('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);
router.post('/feed', postFeed);

export default router;
