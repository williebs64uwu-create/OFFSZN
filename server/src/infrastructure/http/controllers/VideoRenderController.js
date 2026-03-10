/**
 * VideoRenderController.js
 * Server-side FFmpeg video rendering for YouTube+OFFSZN uploads.
 * 
 * SECURITY:
 * - Auth required (JWT)
 * - File MIME validation (image/* + audio/*)
 * - File size limits (cover ≤10MB, audio ≤50MB)
 * - execFile (no shell injection — args as array)
 * - 60s timeout (kills FFmpeg if hung)
 * - Temp files always cleaned up (finally block)
 * - YouTube quota check before processing
 */

import { execFile } from 'child_process';
import { writeFile, unlink, mkdtemp, readFile, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { supabase } from '../../database/connection.js';

// Plan limits (must match auth-utils.js)
const YT_PLAN_LIMITS = { free: 1, starter: 5, pro: 30 };

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];

/**
 * POST /api/youtube/render-video
 * Receives cover image + audio MP3 via multipart form.
 * Returns rendered MP4 video blob.
 */
export const renderVideo = async (req, res) => {
    let tmpDir = null;
    let coverPath = null;
    let audioPath = null;
    let outputPath = null;

    try {
        const userId = req.user.userId;

        // 1. Validate files exist
        if (!req.files || !req.files.cover || !req.files.audio) {
            return res.status(400).json({ error: 'Se requiere cover (imagen) y audio (mp3)' });
        }

        const coverFile = req.files.cover[0];
        const audioFile = req.files.audio[0];

        // 2. MIME validation
        if (!ALLOWED_IMAGE_TYPES.includes(coverFile.mimetype)) {
            return res.status(400).json({ error: `Tipo de imagen no permitido: ${coverFile.mimetype}` });
        }
        if (!ALLOWED_AUDIO_TYPES.includes(audioFile.mimetype)) {
            return res.status(400).json({ error: `Tipo de audio no permitido: ${audioFile.mimetype}` });
        }

        // 3. YouTube quota check (prevent processing if quota exceeded)
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('plan, youtube_uploads_this_month, youtube_quota_reset_date')
            .eq('id', userId)
            .single();

        if (profileErr || !profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        const userPlan = profile.plan || 'free';
        const maxLimit = YT_PLAN_LIMITS[userPlan] || YT_PLAN_LIMITS.free;
        let currentCount = profile.youtube_uploads_this_month || 0;
        const resetDate = profile.youtube_quota_reset_date ? new Date(profile.youtube_quota_reset_date) : null;

        if (resetDate && new Date() > resetDate) {
            currentCount = 0; // Month reset
        }

        if (currentCount >= maxLimit) {
            return res.status(403).json({
                error: `Límite de ${maxLimit} videos YouTube+OFFSZN alcanzado para plan "${userPlan}".`,
                remaining: 0
            });
        }

        // 4. Create temp directory and write files
        tmpDir = await mkdtemp(join(tmpdir(), 'offszn-render-'));
        coverPath = join(tmpDir, 'cover.jpg');
        audioPath = join(tmpDir, 'audio.mp3');
        outputPath = join(tmpDir, 'output.mp4');

        await writeFile(coverPath, coverFile.buffer);
        await writeFile(audioPath, audioFile.buffer);

        // 5. Run FFmpeg natively (Optimized for Free Tier: 720p, 1 thread, ultrafast, max memory control)
        const ffmpegArgs = [
            '-loop', '1',
            '-i', coverPath,
            '-i', audioPath,
            '-threads', '1', // STRICT RAM LIMIT: 1 Thread only
            '-filter_complex', '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p[v]',
            '-map', '[v]',
            '-map', '1:a',
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // FASTEST, LEAST RAM
            '-tune', 'stillimage',
            '-crf', '28', // Lower quality but consumes less resources
            '-max_muxing_queue_size', '1024', // Prevent memory buffer overflows
            '-g', '9999',
            '-c:a', 'copy',
            '-r', '1',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            '-movflags', '+faststart',
            '-y',
            outputPath
        ];

        await new Promise((resolve, reject) => {
            const proc = execFile(ffmpegPath.path, ffmpegArgs, {
                timeout: 60000, // 60s kill switch
                maxBuffer: 10 * 1024 * 1024 // 10MB stderr buffer
            }, (error, stdout, stderr) => {
                if (error) {
                    if (error.killed) {
                        reject(new Error('FFmpeg timeout: proceso cancelado después de 60s'));
                    } else {
                        reject(new Error('FFmpeg error: ' + (error.message || 'desconocido')));
                    }
                } else {
                    resolve();
                }
            });
        });

        // 6. Stream the output file back to client
        const videoBuffer = await readFile(outputPath);

        res.set({
            'Content-Type': 'video/mp4',
            'Content-Length': videoBuffer.length,
            'Content-Disposition': 'attachment; filename="render.mp4"',
            'Cache-Control': 'no-store'
        });
        res.send(videoBuffer);

    } catch (err) {
        console.error('[VideoRender] Error:', err.message);
        res.status(500).json({ error: 'Error al generar el video: ' + err.message });
    } finally {
        // ALWAYS cleanup temp files
        try {
            if (coverPath) await unlink(coverPath).catch(() => { });
            if (audioPath) await unlink(audioPath).catch(() => { });
            if (outputPath) await unlink(outputPath).catch(() => { });
            if (tmpDir) {
                await rmdir(tmpDir).catch(() => { });
            }
        } catch (_) { /* cleanup errors are non-fatal */ }
    }
};
