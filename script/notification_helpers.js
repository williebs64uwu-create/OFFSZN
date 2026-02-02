
// Helper for safely opening profiles
window.openProfile = function (id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (id && id !== 'undefined' && id !== 'null') {
        window.location.href = `/perfil-publico.html?id=${encodeURIComponent(id)}`;
    } else {
        console.warn('Cannot open profile: Invalid ID', id);
    }
};
