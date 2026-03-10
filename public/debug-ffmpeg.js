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
        console.log(msg);
    };

    const toBlobURL = async (url, mimeType) => {
        log(`Fetching ${url}...`);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP Error: ${resp.status}`);
        const buf = await resp.arrayBuffer();
        log(`Creating Blob for ${url} (${buf.byteLength} bytes)`);
        return URL.createObjectURL(new Blob([buf], { type: mimeType }));
    };

    btnLoad.onclick = async () => {
        try {
            btnLoad.disabled = true;
            log('Iniciando carga de FFmpeg...');

            const { FFmpeg } = window.FFmpegWASM;
            ffmpeg = new FFmpeg();

            ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg Internal:', message);
            });

            const origin = window.location.origin;

            log('Preparando URLs de Blob...');
            const coreURL = await toBlobURL(`${origin}/ffmpeg_clean/ffmpeg-core.js`, 'text/javascript');
            const wasmURL = await toBlobURL(`${origin}/ffmpeg_clean/ffmpeg-core.wasm`, 'application/wasm');
            const workerURL = await toBlobURL(`${origin}/ffmpeg_clean/814.ffmpeg.js`, 'text/javascript');

            log('Llamando a ffmpeg.load()...');
            await ffmpeg.load({
                coreURL,
                wasmURL,
                classWorkerURL: workerURL
            });

            log('✅ FFmpeg CARGADO CORRECTAMENTE', false);
            btnRender.disabled = false;
        } catch (err) {
            log(`❌ ERROR AL CARGAR: ${err.message}`, true);
            console.error(err);
        }
    };

    btnRender.onclick = async () => {
        if (!inputImg.files[0] || !inputAudio.files[0]) {
            alert('Selecciona imagen y audio primero');
            return;
        }

        try {
            btnRender.disabled = true;
            log('Iniciando render de prueba (3 segundos)...');

            const fetchFile = async (file) => {
                return new Uint8Array(await file.arrayBuffer());
            };

            await ffmpeg.writeFile('input.jpg', await fetchFile(inputImg.files[0]));
            await ffmpeg.writeFile('audio.mp3', await fetchFile(inputAudio.files[0]));

            log('Ejecutando comando FFmpeg...');
            // Comando ultrarápido solo para probar que el motor funciona
            await ffmpeg.exec([
                '-loop', '1', '-t', '3',
                '-i', 'input.jpg',
                '-i', 'audio.mp3',
                '-c:v', 'libx264',
                '-t', '3',
                '-pix_fmt', 'yuv420p',
                'out.mp4'
            ]);

            const data = await ffmpeg.readFile('out.mp4');
            const videoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

            log('✅ VIDEO GENERADO');
            const video = document.createElement('video');
            video.src = videoUrl;
            video.controls = true;
            video.style.width = '100%';
            status.appendChild(video);

        } catch (err) {
            log(`❌ ERROR EN RENDER: ${err.message}`, true);
            console.error(err);
        } finally {
            btnRender.disabled = false;
        }
    };
})();
