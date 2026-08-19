const fs = require('fs');

let html = fs.readFileSync('D:\\!OFFSZN\\PROYECTOS\\OFFSZN\\plugins\\coca-cola.html', 'utf8');

const OLD_VIDEO_TAG = `                            <video id="demo-video" src="/plugins/coca-cola.mp4" autoplay muted loop playsinline
                                controls
                                style="width: 100%; height: auto; display: block; object-fit: contain;"
                                preload="auto">
                                Tu navegador no soporta la reproducción de video.
                            </video>`;

const NEW_VIDEO_TAG = `                            <video id="demo-video" autoplay muted loop playsinline controls
                                style="width: 100%; height: auto; display: block; object-fit: contain; border-radius: 18px;"
                                preload="auto">
                                <source src="/plugins/COK.mp4" type="video/mp4">
                                <source src="/COK.mp4" type="video/mp4">
                                <source src="/plugins/coca-cola.mp4" type="video/mp4">
                                Tu navegador no soporta la reproducción de video.
                            </video>`;

html = html.replace(OLD_VIDEO_TAG, NEW_VIDEO_TAG);

fs.writeFileSync('D:\\!OFFSZN\\PROYECTOS\\OFFSZN\\plugins\\coca-cola.html', html, 'utf8');
console.log('✅ Updated video tag in plugins/coca-cola.html with COK.mp4 sources');
