const fs = require('fs');
const file = 'c:/Users/Willie/Desktop/OFFSZN/cuenta/Upload/Beats.html';
let content = fs.readFileSync(file, 'utf8');

const startStr = '            function renderYouTubePreview() {';
const endStr = '                window.onPublishNow = async (youtubeId) => {';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    const newFunc =             function renderYouTubePreview() {
                const title = document.getElementById('titleInput')?.value || '';
                const baseDesc = document.getElementById('descInput')?.value || '';
                const key = document.getElementById('keySelect') ? document.getElementById('keySelect').value : '';
                const bpm = document.getElementById('bpmInput') ? document.getElementById('bpmInput').value : '';

                let username = window.AuthUtils && window.AuthUtils.getCurrentUsername ? window.AuthUtils.getCurrentUsername() : 'colaborador';
                if (!username && window.userProfile && window.userProfile.username) username = window.userProfile.username;
                let beatTitle = title || 'beat';
                let slug = beatTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                let formattedTags = typeof tags !== 'undefined' && tags ? tags.map(t => '#' + t.replace(/\\\\s+/g, '')).join(' ') : '';
                
                let customDesc = \\\🛒Comprar/Descargar: https://offszn.lat/\/\\\nKey: \\\nBPM: \\\n\\n\\\n\\n\\\\;

                window.YouTubeUploader.renderPreviewUI('youtube-preview-container', {
                    title: title,
                    desc: customDesc,
                    tags: tags,
                    coverBlob: files.cover,
                    coverUrl: document.getElementById('coverPreview')?.src,
                    audioBlob: files.mp3_tagged || files.wav_untagged
                });

                // Set up onPublishNow handler for after video is rendered + YouTube upload complete
;
    content = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Success! Updated renderYouTubePreview.");
} else {
    console.log("Could not find start or end indices.");
}
