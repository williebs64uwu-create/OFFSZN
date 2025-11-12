// ============================================
// SISTEMA DE TOAST NOTIFICATIONS
// ============================================

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Crear contenedor de toasts
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
      max-width: 400px;
    `;
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = 4000) {
    const toast = this.createToast(message, type);
    this.container.appendChild(toast);

    // Animación de entrada
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);

    // Auto-remover después de la duración
    setTimeout(() => {
      this.remove(toast);
    }, duration);

    return toast;
  }

  createToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const config = this.getConfig(type);
    
    toast.style.cssText = `
      background: ${config.bg};
      border: 1px solid ${config.border};
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      transform: translateX(400px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
      cursor: pointer;
      min-width: 300px;
      max-width: 400px;
    `;

    toast.innerHTML = `
      <div style="flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: ${config.iconBg}; border-radius: 50%;">
        <i class="bi ${config.icon}" style="color: ${config.iconColor}; font-size: 0.875rem;"></i>
      </div>
      <div style="flex: 1; color: #fff; font-size: 0.875rem; font-weight: 500; line-height: 1.4;">
        ${message}
      </div>
      <button onclick="event.stopPropagation(); this.closest('.toast').remove();" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
        <i class="bi bi-x" style="font-size: 1.25rem;"></i>
      </button>
    `;

    // Click para cerrar
    toast.addEventListener('click', () => this.remove(toast));

    return toast;
  }

  getConfig(type) {
    const configs = {
      success: {
        bg: 'linear-gradient(135deg, rgba(12, 188, 135, 0.95), rgba(10, 157, 114, 0.95))',
        border: 'rgba(12, 188, 135, 0.3)',
        icon: 'bi-check-circle-fill',
        iconBg: 'rgba(255, 255, 255, 0.2)',
        iconColor: '#fff'
      },
      error: {
        bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))',
        border: 'rgba(239, 68, 68, 0.3)',
        icon: 'bi-x-circle-fill',
        iconBg: 'rgba(255, 255, 255, 0.2)',
        iconColor: '#fff'
      },
      warning: {
        bg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.95))',
        border: 'rgba(251, 191, 36, 0.3)',
        icon: 'bi-exclamation-triangle-fill',
        iconBg: 'rgba(255, 255, 255, 0.2)',
        iconColor: '#fff'
      },
      info: {
        bg: 'linear-gradient(135deg, rgba(114, 9, 183, 0.95), rgba(86, 11, 173, 0.95))',
        border: 'rgba(114, 9, 183, 0.3)',
        icon: 'bi-info-circle-fill',
        iconBg: 'rgba(255, 255, 255, 0.2)',
        iconColor: '#fff'
      },
      loading: {
        bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
        border: 'rgba(59, 130, 246, 0.3)',
        icon: 'bi-arrow-repeat',
        iconBg: 'rgba(255, 255, 255, 0.2)',
        iconColor: '#fff'
      }
    };

    return configs[type] || configs.info;
  }

  remove(toast) {
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Métodos de conveniencia
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  loading(message) {
    const toast = this.show(message, 'loading', 999999);
    // Añadir animación de rotación al ícono
    const icon = toast.querySelector('.bi-arrow-repeat');
    if (icon) {
      icon.style.animation = 'spin 1s linear infinite';
      // Agregar keyframes si no existen
      if (!document.querySelector('#toast-spin-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-spin-keyframes';
        style.textContent = `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
    return toast;
  }

  // Función especial para confirmación
  async confirm(message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
      `;

      const modal = document.createElement('div');
      modal.style.cssText = `
        background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
        border: 1px solid rgba(114, 9, 183, 0.3);
        border-radius: 16px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: slideUp 0.3s ease;
      `;

      modal.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <div style="width: 48px; height: 48px; background: rgba(114, 9, 183, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
            <i class="bi bi-question-circle" style="font-size: 1.5rem; color: #7209b7;"></i>
          </div>
          <p style="color: #fff; font-size: 1rem; line-height: 1.6; margin: 0;">${message}</p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="toast-btn-cancel" style="flex: 1; padding: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            ${cancelText}
          </button>
          <button class="toast-btn-confirm" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #7209b7, #560bad); border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            ${confirmText}
          </button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Agregar keyframes para animaciones
      if (!document.querySelector('#toast-modal-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-modal-keyframes';
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      const closeModal = (result) => {
        overlay.style.animation = 'fadeIn 0.2s ease reverse';
        setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 200);
      };

      modal.querySelector('.toast-btn-confirm').addEventListener('click', () => closeModal(true));
      modal.querySelector('.toast-btn-cancel').addEventListener('click', () => closeModal(false));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(false);
      });
    });
  }
}

// Instanciar el manager globalmente
const toast = new ToastManager();

// Exportar para uso en módulos
export default toast;
