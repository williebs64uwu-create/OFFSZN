import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../../database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DB_PATH = path.join(__dirname, '../../../../database/kanban_boards.json');

const router = express.Router();

// Helper to ensure database backup folder and file exist
function ensureBackupFile() {
    try {
        const dir = path.dirname(BACKUP_DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(BACKUP_DB_PATH)) {
            const defaultEmpty = {
                offszn: { id: 'offszn', title: '🔥 OFFSZN Ideas & Lanzamientos', desc: 'Bóveda de ideas, desarrollo de vocal presets, plugins VST3 y estrategias de contenido viral.', tags: ['Preset', 'Plugin', 'Contenido', 'Marketing', 'ManyChat', 'Idea'], tasks: [] },
                upc: { id: 'upc', title: '🎓 UPC • Gestión Universitaria', desc: 'Control de cursos, entregas de ciclo, exámenes parciales/finales y proyectos grupales.', tags: ['ProyectoFinal', 'Examen', 'Semana8', 'Grupo', 'Lectura', 'Avance'], tasks: [] },
                pendientes: { id: 'pendientes', title: '🎧 Pendientes Producción Musical', desc: 'Pipeline de trabajo para clientes de estudio: grabación, afinación Melodyne, mezcla y mastering.', tags: ['Mezcla', 'Mastering', 'Afinación', 'Beats', 'Cliente', 'Entrega'], tasks: [] }
            };
            fs.writeFileSync(BACKUP_DB_PATH, JSON.stringify(defaultEmpty, null, 2), 'utf-8');
        }
    } catch (err) {
        console.warn('[KanbanAPI] Error asegurando backup local JSON:', err.message);
    }
}

// GET /api/kanban - Cargar tableros (Supabase primero, con fallback local)
router.get('/kanban', async (req, res) => {
    try {
        ensureBackupFile();

        // 1. Intentar desde Supabase
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('feature_flags')
                    .select('config')
                    .eq('name', 'offszn_kanban_boards')
                    .maybeSingle();

                if (!error && data?.config?.boards) {
                    return res.json({
                        success: true,
                        source: 'supabase',
                        boards: data.config.boards,
                        updated_at: data.config.updated_at
                    });
                }
            } catch (sbErr) {
                console.warn('[KanbanAPI] Supabase read fallback:', sbErr.message);
            }
        }

        // 2. Fallback a archivo JSON local
        if (fs.existsSync(BACKUP_DB_PATH)) {
            const localData = JSON.parse(fs.readFileSync(BACKUP_DB_PATH, 'utf-8'));
            return res.json({
                success: true,
                source: 'local_file',
                boards: localData
            });
        }

        res.json({
            success: true,
            source: 'empty_default',
            boards: {
                offszn: { id: 'offszn', title: '🔥 OFFSZN Ideas & Lanzamientos', desc: 'Bóveda de ideas, desarrollo de vocal presets, plugins VST3 y estrategias de contenido viral.', tags: ['Preset', 'Plugin', 'Contenido', 'Marketing', 'ManyChat', 'Idea'], tasks: [] },
                upc: { id: 'upc', title: '🎓 UPC • Gestión Universitaria', desc: 'Control de cursos, entregas de ciclo, exámenes parciales/finales y proyectos grupales.', tags: ['ProyectoFinal', 'Examen', 'Semana8', 'Grupo', 'Lectura', 'Avance'], tasks: [] },
                pendientes: { id: 'pendientes', title: '🎧 Pendientes Producción Musical', desc: 'Pipeline de trabajo para clientes de estudio: grabación, afinación Melodyne, mezcla y mastering.', tags: ['Mezcla', 'Mastering', 'Afinación', 'Beats', 'Cliente', 'Entrega'], tasks: [] }
            }
        });
    } catch (err) {
        console.error('[KanbanAPI] Error al obtener datos de kanban:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/kanban - Guardar tableros en Supabase y disco
router.post('/kanban', async (req, res) => {
    try {
        const { boards } = req.body;
        if (!boards || typeof boards !== 'object') {
            return res.status(400).json({ success: false, error: 'Objeto "boards" requerido' });
        }

        ensureBackupFile();
        const now = new Date().toISOString();

        // 1. Guardar en Supabase
        let supabaseSaved = false;
        if (supabase) {
            try {
                const { data: existing } = await supabase
                    .from('feature_flags')
                    .select('id')
                    .eq('name', 'offszn_kanban_boards')
                    .maybeSingle();

                if (existing) {
                    const { error: updateErr } = await supabase
                        .from('feature_flags')
                        .update({
                            config: {
                                boards,
                                updated_at: now
                            }
                        })
                        .eq('name', 'offszn_kanban_boards');
                    
                    if (!updateErr) supabaseSaved = true;
                    else console.warn('[KanbanAPI] Error actualizando Supabase:', updateErr.message);
                } else {
                    const { error: insertErr } = await supabase
                        .from('feature_flags')
                        .insert({
                            name: 'offszn_kanban_boards',
                            enabled: true,
                            config: {
                                boards,
                                updated_at: now
                            }
                        });
                    
                    if (!insertErr) supabaseSaved = true;
                    else console.warn('[KanbanAPI] Error insertando Supabase:', insertErr.message);
                }
            } catch (sbErr) {
                console.warn('[KanbanAPI] Supabase write fallback:', sbErr.message);
            }
        }

        // 2. Guardar siempre en archivo local como respaldo infalible
        try {
            fs.writeFileSync(BACKUP_DB_PATH, JSON.stringify(boards, null, 2), 'utf-8');
        } catch (fsErr) {
            console.warn('[KanbanAPI] Error escribiendo backup local JSON:', fsErr.message);
        }

        return res.json({
            success: true,
            supabase_saved: supabaseSaved,
            timestamp: now
        });
    } catch (err) {
        console.error('[KanbanAPI] Error al guardar datos de kanban:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
