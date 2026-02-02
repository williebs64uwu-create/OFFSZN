// ========================================
// SUPABASE INITIALIZATION
// ========================================
// Use the global client initialized by auth-utils.js
const supabaseClient = window.supabaseClient;

if (!supabaseClient) {
    console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
}

// ========================================
// DOM ELEMENTS
// ========================================
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const authConnectView = document.getElementById('authConnectView');
const authConnectedView = document.getElementById('authConnectedView');
const connectionStatus = document.getElementById('connectionStatus');
const channelName = document.getElementById('channelName');
const channelHandle = document.getElementById('channelHandle');

const coverInput = document.getElementById('coverInput');
const coverUploadZone = document.getElementById('coverUploadZone');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const coverPreview = document.getElementById('coverPreview');
const btnRemoveCover = document.getElementById('btnRemoveCover');

const artistInput = document.getElementById('artistInput');
const genreInput = document.getElementById('genreInput');
const moodInput = document.getElementById('moodInput');
const bpmInput = document.getElementById('bpmInput');
const storeLinkInput = document.getElementById('storeLinkInput');

const titleInput = document.getElementById('titleInput');
const descriptionInput = document.getElementById('descriptionInput');
const tagsInput = document.getElementById('tagsInput');
const titleCount = document.getElementById('titleCount');
const descCount = document.getElementById('descCount');

const btnAutocomplete = document.getElementById('btnAutocomplete');
const btnSubmit = document.getElementById('btnSubmit');
const toast = document.getElementById('toast');

// ========================================
// STATE
// ========================================
let youtubeConnected = false;
let coverFile = null;
let currentUser = null;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await checkYouTubeConnection();
    setupEventListeners();
    setupCharCounters();
});

// ========================================
// AUTH MANAGEMENT
// ========================================
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = '../../index.html';
        return;
    }
    currentUser = user;
}

async function checkYouTubeConnection() {
    // Mock: Check localStorage for now
    const connected = localStorage.getItem('youtube_connected') === 'true';
    const channel = localStorage.getItem('youtube_channel_name') || 'Mi Canal';

    if (connected) {
        showConnectedState(channel);
    }
}

function showConnectedState(channel) {
    youtubeConnected = true;
    authConnectView.classList.add('hidden');
    authConnectedView.classList.remove('hidden');
    channelName.textContent = channel;
    channelHandle.textContent = '@' + channel.toLowerCase().replace(/\s/g, '');
    connectionStatus.textContent = 'Conectado';
    connectionStatus.classList.remove('pending');
    connectionStatus.classList.add('connected');
}

function showDisconnectedState() {
    youtubeConnected = false;
    authConnectView.classList.remove('hidden');
    authConnectedView.classList.add('hidden');
    connectionStatus.textContent = 'No conectado';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('pending');
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    // Auth
    btnConnect.addEventListener('click', connectYouTube);
    btnDisconnect.addEventListener('click', disconnectYouTube);

    // Cover Upload
    coverUploadZone.addEventListener('click', () => coverInput.click());
    coverInput.addEventListener('change', handleCoverUpload);
    btnRemoveCover.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCover();
    });

    // Autocomplete
    btnAutocomplete.addEventListener('click', autocompleteMetadata);

    // Submit
    btnSubmit.addEventListener('click', handleSubmit);
}

function setupCharCounters() {
    titleInput.addEventListener('input', () => {
        titleCount.textContent = `${titleInput.value.length}/100`;
    });

    descriptionInput.addEventListener('input', () => {
        descCount.textContent = `${descriptionInput.value.length}/5000`;
    });
}

// ========================================
// YOUTUBE CONNECTION (MOCK)
// ========================================
function connectYouTube() {
    // Mock: Simulate OAuth flow
    const channelName = prompt('Nombre del canal (simulación):', 'OFFSZN Beats');
    if (channelName) {
        localStorage.setItem('youtube_connected', 'true');
        localStorage.setItem('youtube_channel_name', channelName);
        showConnectedState(channelName);
        showToast('Canal conectado exitosamente', 'success');
    }
}

function disconnectYouTube() {
    if (confirm('¿Desconectar tu canal de YouTube?')) {
        localStorage.removeItem('youtube_connected');
        localStorage.removeItem('youtube_channel_name');
        showDisconnectedState();
        showToast('Canal desconectado', 'info');
    }
}

// ========================================
// COVER UPLOAD
// ========================================
function handleCoverUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
        showToast('Solo se permiten imágenes', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen no debe superar 5MB', 'error');
        return;
    }

    coverFile = file;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        coverPreview.src = e.target.result;
        coverPreview.classList.remove('hidden');
        uploadPlaceholder.classList.add('hidden');
        btnRemoveCover.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeCover() {
    coverFile = null;
    coverPreview.src = '';
    coverPreview.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
    btnRemoveCover.classList.add('hidden');
    coverInput.value = '';
}

// ========================================
// AUTOCOMPLETE (OPTIONAL HELPER)
// ========================================
function autocompleteMetadata() {
    const artist = artistInput.value.trim();
    const genre = genreInput.value;
    const mood = moodInput.value;
    const bpm = bpmInput.value.trim();
    const storeLink = storeLinkInput.value.trim();

    // Validate basic info
    if (!artist || !genre || !mood) {
        showToast('Completa Artista, Género y Mood primero', 'error');
        return;
    }

    // Generate suggestions
    const title = generateTitle(artist, genre, mood, bpm);
    const description = generateDescription(artist, genre, mood, bpm, storeLink);
    const tags = generateTags(artist, genre, mood, bpm);

    // Fill fields (user can edit)
    titleInput.value = title;
    descriptionInput.value = description;
    tagsInput.value = tags.join(', ');

    // Update counters
    titleCount.textContent = `${title.length}/100`;
    descCount.textContent = `${description.length}/5000`;

    showToast('Metadata autocompletada. Puedes editarla libremente.', 'success');
}

function generateTitle(artist, genre, mood, bpm) {
    let title = `${artist} Type Beat`;
    if (mood) title += ` | ${mood}`;
    if (genre) title += ` | ${genre}`;
    if (bpm) title += ` | ${bpm} BPM`;
    title += ' | OFFSZN';
    return title.substring(0, 100);
}

function generateDescription(artist, genre, mood, bpm, storeLink) {
    const year = new Date().getFullYear();
    let desc = `🔥 ${artist} Type Beat - ${mood} ${genre}\n\n`;

    if (storeLink) {
        desc += `🛒 COMPRAR BEAT (Descarga Instantánea):\n${storeLink}\n\n`;
    }

    desc += `📊 Información:\n`;
    desc += `• Género: ${genre}\n`;
    desc += `• Mood: ${mood}\n`;
    if (bpm) desc += `• BPM: ${bpm}\n`;
    desc += `• Año: ${year}\n\n`;

    desc += `💎 Producido por OFFSZN\n\n`;
    desc += `📧 Contacto: contact@offszn.com\n`;
    desc += `🌐 Web: https://offszn.com\n\n`;
    desc += `#${artist.replace(/\s/g, '')}TypeBeat #${genre}Beat #TypeBeat${year} #FreeTypeBeat`;

    return desc;
}

function generateTags(artist, genre, mood, bpm) {
    const year = new Date().getFullYear();
    const tags = [
        `${artist.toLowerCase()} type beat`,
        `${genre.toLowerCase()} beat`,
        `${mood.toLowerCase()} beat`,
        'type beat',
        `free type beat ${year}`,
        `${genre.toLowerCase()} type beat`,
        'instrumental',
        'beat',
        'prod offszn',
        'offszn'
    ];

    if (bpm) tags.push(`${bpm} bpm`);

    return tags.slice(0, 15);
}

// ========================================
// VALIDATION & SUBMIT
// ========================================
function handleSubmit() {
    // Validate YouTube connection
    if (!youtubeConnected) {
        showToast('Conecta tu canal de YouTube primero', 'error');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    // Validate cover
    if (!coverFile) {
        showToast('Sube una portada para el video', 'error');
        return;
    }

    // Validate basic info
    if (!artistInput.value.trim() || !genreInput.value || !moodInput.value) {
        showToast('Completa la información básica (Artista, Género, Mood)', 'error');
        return;
    }

    // Validate metadata
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title || title.length < 1 || title.length > 100) {
        showToast('El título debe tener entre 1 y 100 caracteres', 'error');
        return;
    }

    if (!description || description.length < 1 || description.length > 5000) {
        showToast('La descripción debe tener entre 1 y 5000 caracteres', 'error');
        return;
    }

    // All good - proceed with upload
    uploadToYouTube();
}

async function uploadToYouTube() {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Subiendo...';

    try {
        // Mock: Simulate upload
        await new Promise(resolve => setTimeout(resolve, 2000));

        const metadata = {
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            tags: tagsInput.value.trim(),
            artist: artistInput.value.trim(),
            genre: genreInput.value,
            mood: moodInput.value,
            bpm: bpmInput.value.trim(),
            storeLink: storeLinkInput.value.trim()
        };

        console.log('YouTube Upload Metadata:', metadata);
        console.log('Cover File:', coverFile);

        showToast('¡Video subido a YouTube exitosamente!', 'success');

        // Reset form after success
        setTimeout(() => {
            if (confirm('¿Subir otro beat?')) {
                resetForm();
            } else {
                window.location.href = '../dashboard.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error al subir el video. Intenta de nuevo.', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Subir a YouTube';
    }
}

function resetForm() {
    // Keep YouTube connection
    removeCover();
    artistInput.value = '';
    genreInput.value = '';
    moodInput.value = '';
    bpmInput.value = '';
    storeLinkInput.value = '';
    titleInput.value = '';
    descriptionInput.value = '';
    tagsInput.value = '';
    titleCount.textContent = '0/100';
    descCount.textContent = '0/5000';
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type);
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
