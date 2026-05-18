/**
 * state.js
 * El núcleo del Store Builder. 
 * Mantiene el JSON del estado actual y notifica a los componentes cuando algo cambia.
 */

export class StoreState {
    constructor(initialState) {
        this.state = initialState || { theme: {}, sections: [] };
        this.listeners = [];
    }

    // Obtener el estado completo
    get() {
        return this.state;
    }

    // Suscribir funciones para ser avisadas cuando hay cambios
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Actualizar todo el estado
    set(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    // Actualizar una propiedad del tema (ej. color)
    updateThemeProp(key, value) {
        this.state.theme[key] = value;
        this.notify();
    }

    // Actualizar un bloque específico
    updateSection(sectionId, newProps) {
        const idx = this.state.sections.findIndex(s => s.id === sectionId);
        if (idx > -1) {
            this.state.sections[idx].props = {
                ...this.state.sections[idx].props,
                ...newProps
            };
            this.notify();
        }
    }

    // Avisar a todos los escuchas
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
