// ============================================
// CARGAR PERFIL DEL USUARIO
// ============================================
async function cargarPerfil() {
  const nickname = getNicknameFromURL();
  
  console.log('🔍 Buscando usuario:', nickname);
  
  try {
    // CAMBIO: Usar la API pública en lugar de consultar Supabase directamente
    const response = await fetch(`https://offszn1.onrender.com/api/profile/${nickname}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error('❌ Usuario no encontrado');
        mostrarError('Usuario no encontrado');
        return;
      }
      throw new Error('Error al cargar el perfil');
    }

    const user = await response.json();
    console.log('✅ Usuario cargado correctamente:', user);

    currentUserId = user.id;
    actualizarHeaderPerfil(user);
    await cargarProductos(user.id);
    await cargarEstadisticas(user.id);
    inicializarFiltros();
    inicializarBusqueda();

  } catch (error) {
    console.error('❌ Error cargando perfil:', error);
    mostrarError('Error al cargar el perfil. Por favor, intenta de nuevo.');
  }
}
