(function () {
    const status = document.getElementById('status');
    const btnLoad = document.getElementById('btn-load');
    const btnRender = document.getElementById('btn-render');
    const inputImg = document.getElementById('input-img');
    const inputAudio = document.getElementById('input-audio');

    let ffmpeg = null;

    const log = (msg, isError = false) => {
        const span = document.createElement('div');
        span.className = isError ? 'error' : 'success';
        span.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        status.appendChild(span);
        status.scrollTop = status.scrollHeight;
        console.log(msg);
    };

    // Check for SharedArrayBuffer
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    const isIsolated = window.crossOriginIsolated;
    log(`Capacidades del navegador:`);
    log(`- SharedArrayBuffer: ${hasSAB ? '✅ DISPONIBLE' : '❌ NO DISPONIBLE'}`);
    log(`- Aislamiento (COOP/COEP): ${isIsolated ? '✅ ACTIVO' : '❌ INACTIVO'}`);

    btnLoad.onclick = async () => {
        try {
            btnLoad.disabled = true;
            status.innerHTML = '';
            log('🚀 Iniciando carga ESM Core (Preferido)...');

            const { FFmpeg } = window.FFmpegWASM;
            ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                log(`[FFmpeg] ${message}`);
            });

            const origin = window.location.origin;

            try {
                log('🔄 Intentando cargar FFmpeg con ESM Core...');
                await ffmpeg.load({
                    coreURL: `${origin}/ffmpeg_clean/ffmpeg-core.esm.js`,
                    wasmURL: `${origin}/ffmpeg_clean/ffmpeg-core.wasm`,
                    classWorkerURL: `${origin}/ffmpeg_clean/814.ffmpeg.js`
                });
                log('✅ FFMPEG LISTO (Modo ESM)');
            } catch (esmErr) {
                log(`⚠️ Falló ESM (${esmErr.message}). Probando modo UMD...`, true);

                // Si falla ESM, destruimos esa instancia y probamos UMD
                ffmpeg = new FFmpeg();
                ffmpeg.on('log', ({ message }) => log(`[FFmpeg] ${message}`));

                await ffmpeg.load({
                    coreURL: `${origin}/ffmpeg_clean/ffmpeg-core.js`,
                    wasmURL: `${origin}/ffmpeg_clean/ffmpeg-core.wasm`,
                    classWorkerURL: `${origin}/ffmpeg_clean/814.ffmpeg.js`
                });
                log('✅ FFMPEG LISTO (Modo UMD)');
            }

            btnRender.disabled = false;
        } catch (err) {
            const errorMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            log(`❌ ERROR FATAL: ${errorMsg}`, true);
            console.error('Detalle error:', err);
            btnLoad.disabled = false;
        }
    };

    btnRender.onclick = async () => {
        if (!inputImg.files[0] || !inputAudio.files[0]) {
            alert('Selecciona imagen y audio');
            return;
        }
        try {
            btnRender.disabled = true;
            log('🎥 Renderizando...');
            const fetchFile = async (file) => new Uint8Array(await file.arrayBuffer());
            await ffmpeg.writeFile('in.jpg', await fetchFile(inputImg.files[0]));
            await ffmpeg.writeFile('audio.mp3', await fetchFile(inputAudio.files[0]));
            await ffmpeg.exec([
                '-loop', '1',
                '-t', '2',
                '-i', 'in.jpg',
                '-i', 'audio.mp3',
                '-filter_complex', '[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v]',
                '-map', '[v]',
                '-map', '1:a',
                '-c:v', 'libx264',
                '-t', '2',
                'out.mp4'
            ]);
            const data = await ffmpeg.readFile('out.mp4');
            const videoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            log('✨ VIDEO GENERADO');
            const video = document.createElement('video');
            video.src = videoUrl; video.controls = true; video.style.width = '100%';
            status.appendChild(video);
        } catch (err) {
            log(`❌ ERROR RENDER: ${err.message}`, true);
        } finally {
            btnRender.disabled = false;
        }
    };
})();
