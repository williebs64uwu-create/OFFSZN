const fs = require('fs');
const path = 'c:/Users/Willie/Desktop/OFFSZN/cuenta/Upload/Beats.html';
let content = fs.readFileSync(path, 'utf8');

const targetStr =             function renderYouTubePreview() {
                window.YouTubeUploader.renderPreviewUI('youtube-preview-container', {
                    title: document.getElementById('titleInput')?.value,
                    desc: document.getElementById('descInput')?.value,
                    tags: tags,
                    coverBlob: files.cover,
                    coverUrl: document.getElementById('coverPreview')?.src,
                    audioBlob: files.mp3_tagged || files.wav_untagged
                });;

const replacementStr =             function renderYouTubePreview() {
                const title = document.getElementById('titleInput')?.value || '';
                const baseDesc = document.getElementById('descInput')?.value || '';
                const key = document.getElementById('keySelect')?.value || '';
                const bpm = document.getElementById('bpmInput')?.value || '';

                let username = window.AuthUtils?.getCurrentUsername ? window.AuthUtils.getCurrentUsername() : 'artist';
                if (!username && window.userProfile?.username) username = window.userProfile.username;
                let beatTitle = title || 'beat';
                let slug = beatTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                let formattedTags = typeof tags !== 'undefined' && tags ? tags.map(t => '#' + t.replace(/\\s+/g, '')).join(' ') : '';
                
                let customDesc = \🛒Comprar/Descargar: https://offszn.lat/\/\\\nKey: \\\nBPM: \\\n\\n\\\n\\n\\;

                window.YouTubeUploader.renderPreviewUI('youtube-preview-container', {
                    title: title,
                    desc: customDesc,
                    tags: tags,
                    coverBlob: files.cover,
                    coverUrl: document.getElementById('coverPreview')?.src,
                    audioBlob: files.mp3_tagged || files.wav_untagged
                });;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated the YouTube description format.');
} else {
    console.log('Target string not found in the file.');
}
