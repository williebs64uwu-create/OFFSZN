// Script para manejar el popup de EmailOctopus
(function() {
  'use strict';
  
  // Esperar a que el DOM esté completamente cargado
  document.addEventListener('DOMContentLoaded', function() {
    
    // Dar tiempo para que EmailOctopus cargue sus scripts
    setTimeout(function() {
      
      // Buscar el botón con el atributo data-eo-form-toggle-id
      const downloadBtn = document.querySelector('[data-eo-form-toggle-id="c6ea1c0a-a946-11f0-a963-2d3399b4bc98"]');
      
      if (downloadBtn) {
        console.log('✅ Botón encontrado');
        
        downloadBtn.addEventListener('click', function(e) {
          e.preventDefault();
          console.log('🔵 Botón clickeado');
          
          // Buscar el formulario/modal de EmailOctopus
          const eoForms = document.querySelectorAll('[data-form="c6ea1c0a-a946-11f0-a963-2d3399b4bc98"]');
          
          if (eoForms.length > 0) {
            console.log('✅ Formulario encontrado');
            
            // Intentar mostrar el modal
            eoForms.forEach(function(form) {
              form.style.display = 'block';
              form.style.opacity = '1';
              form.style.visibility = 'visible';
              
              // Agregar clase si existe
              if (form.classList) {
                form.classList.add('eo-form-visible');
              }
            });
          } else {
            console.log('❌ Formulario no encontrado. Intentando método alternativo...');
            
            // Método alternativo: simular click en elemento oculto de EmailOctopus
            const hiddenTrigger = document.querySelector('.eo-form-popup-trigger');
            if (hiddenTrigger) {
              hiddenTrigger.click();
            }
          }
        });
      } else {
        console.log('❌ Botón no encontrado');
      }
      
    }, 2000); // Esperar 2 segundos
    
  });
})();
