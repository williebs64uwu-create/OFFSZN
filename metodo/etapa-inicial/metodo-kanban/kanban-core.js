/**
 * OFFSZN KANBAN SUITE • CORE ENGINE (v2.0 Elite Redesign)
 * Pixel-perfect DROPDOWNS.png & Tipodecalendario.png replicas,
 * high-contrast visual calendar, Linear/Notion table & drag-and-drop kanban.
 */

const STORAGE_KEY = 'OFFSZN_KANBAN_DATABASE_V3';

function normalizeStatus(status) {
  if (!status) return 'pendiente';
  const s = String(status).toLowerCase().trim();
  if (s === 'backlog' || s === 'todo' || s === 'pendiente' || s === 'pending') return 'pendiente';
  if (s === 'in-progress' || s === 'en-curso' || s === 'in_progress' || s === 'progreso') return 'en-curso';
  if (s === 'complete' || s === 'listo' || s === 'completed' || s === 'terminado') return 'listo';
  return 'pendiente';
}

function getTagColor(tag) {
  const t = String(tag || '').toLowerCase().trim();
  if (t.includes('mezcla') || t.includes('mix')) {
    return { bg: 'rgba(168, 85, 247, 0.18)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' };
  }
  if (t.includes('master') || t.includes('mastering')) {
    return { bg: 'rgba(59, 130, 246, 0.18)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.35)' };
  }
  if (t.includes('afin') || t.includes('vocal') || t.includes('preset')) {
    return { bg: 'rgba(236, 72, 153, 0.18)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' };
  }
  if (t.includes('beat') || t.includes('prod') || t.includes('remake')) {
    return { bg: 'rgba(6, 182, 212, 0.18)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.35)' };
  }
  if (t.includes('cliente') || t.includes('pago') || t.includes('venta')) {
    return { bg: 'rgba(16, 185, 129, 0.18)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (t.includes('entrega') || t.includes('urgente') || t.includes('examen') || t.includes('parcial')) {
    return { bg: 'rgba(245, 158, 11, 0.18)', text: '#fde68a', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (t.includes('plugin') || t.includes('agente') || t.includes('codigo') || t.includes('código')) {
    return { bg: 'rgba(99, 102, 241, 0.18)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.35)' };
  }
  const palette = [
    { bg: 'rgba(168, 85, 247, 0.18)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' },
    { bg: 'rgba(59, 130, 246, 0.18)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.35)' },
    { bg: 'rgba(16, 185, 129, 0.18)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.35)' },
    { bg: 'rgba(245, 158, 11, 0.18)', text: '#fde68a', border: 'rgba(245, 158, 11, 0.35)' },
    { bg: 'rgba(236, 72, 153, 0.18)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' },
    { bg: 'rgba(6, 182, 212, 0.18)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.35)' }
  ];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

// Clean initial empty boards ready for user's own genuine tasks
const DEFAULT_BOARDS_DATA = {
  offszn: {
    id: 'offszn',
    title: '🔥 OFFSZN Ideas & Lanzamientos',
    desc: 'Bóveda de ideas, desarrollo de vocal presets, plugins VST3 y estrategias de contenido viral.',
    tags: ['Preset', 'Plugin', 'Contenido', 'Marketing', 'ManyChat', 'Idea'],
    tasks: []
  },
  upc: {
    id: 'upc',
    title: '🎓 UPC • Gestión Universitaria',
    desc: 'Control de cursos, entregas de ciclo, exámenes parciales/finales y proyectos grupales.',
    tags: ['ProyectoFinal', 'Examen', 'Semana8', 'Grupo', 'Lectura', 'Avance'],
    tasks: []
  },
  pendientes: {
    id: 'pendientes',
    title: '🎧 Pendientes Producción Musical',
    desc: 'Pipeline de trabajo para clientes de estudio: grabación, afinación Melodyne, mezcla y mastering.',
    tags: ['Mezcla', 'Mastering', 'Afinación', 'Beats', 'Cliente', 'Entrega'],
    tasks: []
  }
};

let syncTimeout = null;

function updateSyncStatus(status) {
  let badge = document.getElementById('cloud-sync-badge');
  if (!badge) {
    const navRight = document.querySelector('.nav-right');
    if (navRight) {
      badge = document.createElement('div');
      badge.id = 'cloud-sync-badge';
      navRight.prepend(badge);
    }
  }
  if (!badge) return;

  if (status === 'syncing') {
    badge.className = 'cloud-sync-badge syncing';
    badge.innerHTML = `<span class="sync-dot"></span><span>Sincronizando BD...</span>`;
    badge.title = 'Guardando en Base de Datos (Supabase)...';
  } else if (status === 'synced') {
    badge.className = 'cloud-sync-badge synced';
    badge.innerHTML = `<span class="sync-dot"></span><span>Conectado a BD</span>`;
    badge.title = 'Sincronizado con Supabase';
  } else if (status === 'error') {
    badge.className = 'cloud-sync-badge error';
    badge.innerHTML = `<span class="sync-dot"></span><span>Local (Reintentando...)</span>`;
    badge.title = 'Guardado localmente en caché.';
  }
}

async function syncWithServer(db) {
  updateSyncStatus('syncing');
  try {
    const res = await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boards: db })
    });
    if (res.ok) {
      updateSyncStatus('synced');
    } else {
      updateSyncStatus('error');
    }
  } catch (err) {
    console.warn('[Kanban] Error al sincronizar con /api/kanban:', err);
    updateSyncStatus('error');
  }
}

function getKanbanDB() {
  try {
    // Purge old mock versions
    localStorage.removeItem('OFFSZN_KANBAN_DATABASE_V2');
    localStorage.removeItem('OFFSZN_KANBAN_DATABASE');

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BOARDS_DATA));
      return JSON.parse(JSON.stringify(DEFAULT_BOARDS_DATA));
    }
    const parsed = JSON.parse(raw);
    // Ensure all 3 boards exist
    ['offszn', 'upc', 'pendientes'].forEach(b => {
      if (!parsed[b]) parsed[b] = JSON.parse(JSON.stringify(DEFAULT_BOARDS_DATA[b]));
      if (!Array.isArray(parsed[b].tasks)) parsed[b].tasks = [];
    });
    return parsed;
  } catch (e) {
    console.error('Error loading DB:', e);
    return JSON.parse(JSON.stringify(DEFAULT_BOARDS_DATA));
  }
}

function saveKanbanDB(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Error saving DB:', e);
  }

  // Auto-sync debounce to Supabase
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncWithServer(db);
  }, 350);
}

class KanbanApp {
  constructor(boardId) {
    this.boardId = boardId;
    this.db = getKanbanDB();
    this.currentView = 'kanban';
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterPriority = 'all';
    this.selectedTag = 'all';
    this.draggedTaskId = null;

    // Calendar view state (defaults to current date)
    const today = new Date();
    this.calViewYear = today.getFullYear();
    this.calViewMonth = today.getMonth();

    // Popover states
    this.activeDropdown = null;
    this.activeCalendar = null;

    this.init();
  }

  init() {
    this.createGlobalPopovers();
    this.createTaskModal();

    if (this.boardId === 'hub') {
      this.renderHubDashboard();
    } else {
      this.renderBoard();
    }

    this.setupGlobalEvents();
    this.fetchCloudSync();
  }

  async fetchCloudSync() {
    updateSyncStatus('syncing');
    try {
      const res = await fetch('/api/kanban');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.boards && typeof data.boards === 'object') {
          // Verify valid structure
          ['offszn', 'upc', 'pendientes'].forEach(b => {
            if (!data.boards[b]) data.boards[b] = JSON.parse(JSON.stringify(DEFAULT_BOARDS_DATA[b]));
            if (!Array.isArray(data.boards[b].tasks)) data.boards[b].tasks = [];
          });
          this.db = data.boards;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
          if (this.boardId === 'hub') {
            this.renderHubDashboard();
          } else {
            this.renderBoard();
          }
          updateSyncStatus('synced');
          return;
        }
      }
    } catch (err) {
      console.warn('[Kanban] No se pudo obtener datos remotos, usando caché:', err);
    }
    updateSyncStatus('synced');
  }

  getBoardData() {
    return this.db[this.boardId] || null;
  }

  renderBoard() {
    const board = this.getBoardData();
    if (!board) return;

    const titleEl = document.getElementById('boardTitle');
    const descEl = document.getElementById('boardDesc');
    if (titleEl) titleEl.innerHTML = board.title;
    if (descEl) descEl.textContent = board.desc;

    this.renderTagChips();
    this.renderCurrentView();
  }

  renderTagChips() {
    const container = document.getElementById('tagChipsContainer');
    if (!container) return;

    const board = this.getBoardData();
    const tags = board.tags || [];

    let html = `<span class="tag-label">TAGS:</span>`;
    html += `<button type="button" class="tag-chip ${this.selectedTag === 'all' ? 'active' : ''}" onclick="app.setTagFilter('all')">Todos</button>`;

    tags.forEach(tag => {
      const active = this.selectedTag === tag ? 'active' : '';
      html += `<button type="button" class="tag-chip ${active}" onclick="app.setTagFilter('${tag}')">#${tag}</button>`;
    });

    container.innerHTML = html;
  }

  getFilteredTasks() {
    const board = this.getBoardData();
    if (!board) return [];

    let tasks = [...board.tasks];

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      tasks = tasks.filter(t => 
        t.title.toLowerCase().includes(q) ||
        (t.desc && t.desc.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    if (this.filterStatus !== 'all') {
      tasks = tasks.filter(t => normalizeStatus(t.status) === this.filterStatus);
    }

    if (this.filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === this.filterPriority);
    }

    if (this.selectedTag !== 'all') {
      tasks = tasks.filter(t => t.tags && t.tags.includes(this.selectedTag));
    }

    return tasks;
  }

  renderCurrentView() {
    const kanbanGrid = document.getElementById('kanbanGrid');
    const tableView = document.getElementById('tableViewContainer');
    const monthView = document.getElementById('monthCalendarView');

    if (this.currentView === 'kanban') {
      if (kanbanGrid) kanbanGrid.style.display = '';
      if (tableView) tableView.style.display = 'none';
      if (monthView) monthView.style.display = 'none';
      this.renderKanbanColumns();
    } else if (this.currentView === 'table') {
      if (kanbanGrid) kanbanGrid.style.display = 'none';
      if (tableView) tableView.style.display = 'block';
      if (monthView) monthView.style.display = 'none';
      this.renderTableView();
    } else if (this.currentView === 'calendar') {
      if (kanbanGrid) kanbanGrid.style.display = 'none';
      if (tableView) tableView.style.display = 'none';
      if (monthView) monthView.style.display = 'block';
      this.renderMonthCalendarView();
    }
  }

  // ═════════════════════════════════════════════════════════════
  // HOVER.DEV × NOTION HYBRID KANBAN COLUMNS & CARDS
  // 3 Canonical Columns (Pendiente, En curso, Listo) & Rich Colors
  // ═════════════════════════════════════════════════════════════
  renderKanbanColumns() {
    const tasks = this.getFilteredTasks();

    const columns = [
      { id: 'pendiente', name: 'Pendiente', pillClass: 'pill-pendiente', icon: '⏳' },
      { id: 'en-curso', name: 'En curso', pillClass: 'pill-en-curso', icon: '⚡' },
      { id: 'listo', name: 'Listo', pillClass: 'pill-listo', icon: '✅' }
    ];

    const mobileTabs = document.getElementById('mobileColumnTabs');
    if (mobileTabs) {
      mobileTabs.innerHTML = columns.map(c => {
        const count = tasks.filter(t => normalizeStatus(t.status) === c.id).length;
        return `<button type="button" class="mobile-col-btn" onclick="app.scrollToColumn('${c.id}')">
          <span class="col-indicator ${c.id}"></span> ${c.icon} ${c.name} (${count})
        </button>`;
      }).join('');
    }

    columns.forEach(col => {
      const colCards = tasks.filter(t => normalizeStatus(t.status) === col.id);
      const countEl = document.getElementById(`count-${col.id}`);
      const listEl = document.getElementById(`list-${col.id}`);
      const slotEl = document.getElementById(`slot-${col.id}`);

      if (countEl) countEl.textContent = colCards.length;
      if (listEl) {
        let cardsHtml = '';
        const firstBefore = colCards.length > 0 ? colCards[0].id : '-1';
        cardsHtml += `<div class="drop-indicator" data-before="${firstBefore}" data-column="${col.id}"></div>`;

        colCards.forEach((task, idx) => {
          const next = colCards[idx + 1];
          const beforeId = next ? next.id : '-1';
          cardsHtml += this.createHoverCardHTML(task);
          cardsHtml += `<div class="drop-indicator" data-before="${beforeId}" data-column="${col.id}"></div>`;
        });

        listEl.innerHTML = cardsHtml;
      }

      if (slotEl) {
        if (this.activeInlineAddCol === col.id) {
          slotEl.innerHTML = `
            <div class="inline-add-card-form">
              <textarea id="inline-textarea-${col.id}" class="inline-add-textarea" placeholder="Escribe el nombre de la tarea..." 
                onkeydown="app.handleInlineKeydown(event, '${col.id}')"></textarea>
              
              <div class="inline-quick-props">
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600;">Prioridad:</span>
                  <select id="inline-priority-${col.id}" class="inline-select-priority">
                    <option value="medium" selected>● Media</option>
                    <option value="high">▲ Alta</option>
                    <option value="urgent">⚡ Urgente</option>
                    <option value="low">▼ Baja</option>
                  </select>
                </div>
              </div>

              <div class="inline-add-actions">
                <button type="button" class="btn-inline-close" onclick="app.closeInlineAdd('${col.id}')">Cancelar</button>
                <button type="button" class="btn-inline-submit" onclick="app.submitInlineAdd('${col.id}')">
                  <span>+ Añadir Tarea</span>
                </button>
              </div>
            </div>
          `;
          setTimeout(() => {
            const ta = document.getElementById(`inline-textarea-${col.id}`);
            if (ta) ta.focus();
          }, 20);
        } else {
          slotEl.innerHTML = `
            <button type="button" class="btn-add-card" onclick="app.openInlineAdd('${col.id}')">
              <span>+ Añadir tarea</span>
            </button>
          `;
        }
      }
    });

    this.attachHoverDragEvents();
  }

  createHoverCardHTML(task) {
    const normStatus = normalizeStatus(task.status);
    const todayStr = new Date().toISOString().split('T')[0];
    const isOverdue = task.dueDate && task.dueDate < todayStr && normStatus !== 'listo';
    const isNear = task.dueDate && !isOverdue && normStatus !== 'listo';

    // Priority chip with vivid colors
    const p = (task.priority || 'medium').toLowerCase();
    let priorityHtml = '';
    if (p === 'urgent') {
      priorityHtml = `<span class="priority-chip chip-urgent"><span class="priority-dot"></span>⚡ Urgente</span>`;
    } else if (p === 'high') {
      priorityHtml = `<span class="priority-chip chip-high"><span class="priority-dot"></span>▲ Alta</span>`;
    } else if (p === 'medium') {
      priorityHtml = `<span class="priority-chip chip-medium"><span class="priority-dot"></span>● Media</span>`;
    } else {
      priorityHtml = `<span class="priority-chip chip-low"><span class="priority-dot"></span>▼ Baja</span>`;
    }

    // Status chip for extra visual clarity (matching DROPDOWNS.png)
    let statusChipHtml = '';
    if (normStatus === 'en-curso') {
      statusChipHtml = `<span class="status-pill-badge pill-en-curso mini-pill"><span class="status-indicator-dot pulse"></span>En curso</span>`;
    } else if (normStatus === 'listo') {
      statusChipHtml = `<span class="status-pill-badge pill-listo mini-pill"><span class="status-indicator-dot"></span>Listo</span>`;
    }

    // Smart Tag Detection: Ensure every card has colorful, distinct Notion tags
    let rawTags = Array.isArray(task.tags) ? [...task.tags] : [];
    if (rawTags.length === 0) {
      const tLow = (task.title || '').toLowerCase();
      if (tLow.includes('beat') || tLow.includes('remake')) rawTags.push('Beats');
      if (tLow.includes('preset') || tLow.includes('vocal')) rawTags.push('Preset');
      if (tLow.includes('plugin') || tLow.includes('deeser')) rawTags.push('Plugin');
      if (tLow.includes('ordenar') || tLow.includes('pc') || tLow.includes('archivo')) rawTags.push('Organización');
      if (tLow.includes('landing') || tLow.includes('web') || tLow.includes('página') || tLow.includes('pagina')) rawTags.push('Desarrollo');
      if (tLow.includes('tiktok') || tLow.includes('video') || tLow.includes('contenido')) rawTags.push('Contenido');
      if (tLow.includes('mezcla') || tLow.includes('mix')) rawTags.push('Mezcla');
      if (tLow.includes('master') || tLow.includes('mastering')) rawTags.push('Mastering');
      if (tLow.includes('agente') || tLow.includes('investigar')) rawTags.push('Investigación');
      if (tLow.includes('examen') || tLow.includes('parcial') || tLow.includes('final')) rawTags.push('Examen');
      if (tLow.includes('grupo') || tLow.includes('uni')) rawTags.push('UPC');
      
      // If still empty, assign a default contextual tag so card is never colorless
      if (rawTags.length === 0) {
        if (this.boardId === 'pendientes') rawTags.push('Producción');
        else if (this.boardId === 'offszn') rawTags.push('OFFSZN');
        else if (this.boardId === 'upc') rawTags.push('Universidad');
        else rawTags.push('General');
      }
    }

    // Tags HTML with rich Notion pastel colors
    const tagsHtml = rawTags.map(tg => {
      const tc = getTagColor(tg);
      return `<span class="hover-card-tag" style="background:${tc.bg}; color:${tc.text}; border-color:${tc.border};">#${this.escapeHTML(tg)}</span>`;
    }).join('');

    // Due date badge
    let dueHtml = '';
    if (task.dueDate) {
      const dueFormatted = this.formatShortDate(task.dueDate);
      const dateClass = isOverdue ? 'overdue' : (isNear ? 'near' : '');
      const icon = isOverdue ? '🚨' : '📅';
      dueHtml = `<span class="hover-card-date ${dateClass}">${icon} ${dueFormatted}</span>`;
    }

    return `
      <div class="hover-card card-priority-${p} card-status-${normStatus}" draggable="true" data-id="${task.id}" onclick="app.onCardClick(event, '${task.id}')">
        <div class="hover-card-head">
          <div class="card-head-badges">
            ${priorityHtml}
            ${statusChipHtml}
          </div>
          <div class="hover-card-actions">
            <button type="button" class="hover-card-btn" title="Editar detalles" onclick="event.stopPropagation(); app.openEditModal('${task.id}')">✎</button>
            <button type="button" class="hover-card-btn delete-btn" title="Eliminar" onclick="event.stopPropagation(); app.deleteTask('${task.id}')">✕</button>
          </div>
        </div>

        <div class="hover-card-title">${this.escapeHTML(task.title)}</div>
        ${task.desc ? `<div class="hover-card-desc">${this.escapeHTML(task.desc)}</div>` : ''}

        <div class="hover-card-meta">
          <div class="hover-card-tags">${tagsHtml}</div>
          <div class="hover-card-meta-right">
            ${dueHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Backwards compatibility alias for modal & table views
  createCardHTML(task) {
    return this.createHoverCardHTML(task);
  }

  openInlineAdd(colId) {
    this.activeInlineAddCol = colId;
    this.renderKanbanColumns();
  }

  closeInlineAdd(colId) {
    this.activeInlineAddCol = null;
    this.renderKanbanColumns();
  }

  handleInlineKeydown(event, colId) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitInlineAdd(colId);
    } else if (event.key === 'Escape') {
      this.closeInlineAdd(colId);
    }
  }

  submitInlineAdd(colId) {
    const ta = document.getElementById(`inline-textarea-${colId}`);
    if (!ta) return;
    const val = ta.value.trim();
    if (!val) {
      this.closeInlineAdd(colId);
      return;
    }

    const prioSelect = document.getElementById(`inline-priority-${colId}`);
    const chosenPriority = prioSelect ? prioSelect.value : 'medium';

    const board = this.getBoardData();
    if (board) {
      const newTask = {
        id: `${this.boardId}-${Date.now().toString(36)}`,
        title: val,
        desc: '',
        status: colId,
        priority: chosenPriority,
        startDate: '',
        dueDate: '',
        tags: []
      };
      board.tasks.push(newTask);
      saveKanbanDB(this.db);
      this.activeInlineAddCol = null;
      this.renderBoard();
    }
  }

  // ═════════════════════════════════════════════════════════════
  // VIEW 2: HIGH-END DATABASE TABLE VIEW (NOTION / AIRTABLE STYLE)
  // ═════════════════════════════════════════════════════════════
  renderTableView() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const tasks = this.getFilteredTasks();

    if (tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-faint);">No se encontraron tareas con los filtros actuales.</td></tr>`;
      return;
    }

    const priorityMeta = {
      urgent: { label: '⚡ Urgente', class: 'urgent' },
      high: { label: '▲ Alta', class: 'high' },
      medium: { label: '● Media', class: 'medium' },
      low: { label: '▼ Baja', class: 'low' }
    };

    const statusLabels = {
      'pendiente': 'Pendiente',
      'en-curso': 'En curso',
      'listo': 'Listo',
      'backlog': 'Pendiente',
      'todo': 'Pendiente',
      'in-progress': 'En curso',
      'complete': 'Listo'
    };

    const todayStr = new Date().toISOString().split('T')[0];

    tbody.innerHTML = tasks.map(t => {
      const pMeta = priorityMeta[t.priority] || priorityMeta.medium;
      const normStatus = normalizeStatus(t.status);
      const isOverdue = t.dueDate && t.dueDate < todayStr && normStatus !== 'listo';

      return `
        <tr>
          <td style="font-weight: 600; color: #ffffff; max-width: 340px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="app.openEditModal('${t.id}')">
              <span class="card-id-badge">#${(t.id || '').toUpperCase()}</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHTML(t.title)}</span>
            </div>
          </td>
          <td>
            <button type="button" class="status-dropdown-trigger ${normStatus}" onclick="app.openDropdownPopover(event, '${t.id}')">
              ● ${statusLabels[normStatus] || normStatus} ▾
            </button>
          </td>
          <td>
            <span class="priority-pill ${pMeta.class}">${pMeta.label}</span>
          </td>
          <td>
            <button type="button" class="date-trigger-btn ${t.startDate ? 'has-date' : ''}" 
              title="Cambiar fecha de inicio" onclick="app.openCalendarPopover(event, '${t.id}', 'startDate')">
              📅 ${t.startDate ? this.formatShortDate(t.startDate) : '+ Fecha inicio'}
            </button>
          </td>
          <td>
            <button type="button" class="date-trigger-btn ${t.dueDate ? 'has-date' : ''} ${isOverdue ? 'overdue' : ''}" 
              title="Cambiar fecha de finalización" onclick="app.openCalendarPopover(event, '${t.id}', 'dueDate')">
              🏁 ${t.dueDate ? this.formatShortDate(t.dueDate) : '+ Fecha fin'} ${isOverdue ? '<span class="overdue-dot" title="Vencido">!</span>' : ''}
            </button>
          </td>
          <td>${(t.tags || []).map(tg => `<span class="card-tag">#${tg}</span>`).join(' ')}</td>
          <td>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="card-menu-btn" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-card);" title="Editar" onclick="app.openEditModal('${t.id}')">✎</button>
              <button type="button" class="card-menu-btn delete-btn" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-card);" title="Eliminar" onclick="app.deleteTask('${t.id}')">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ═════════════════════════════════════════════════════════════
  // VIEW 3: HIGH-CONTRAST MONTHLY CALENDAR VIEW
  // ═════════════════════════════════════════════════════════════
  renderMonthCalendarView() {
    const grid = document.getElementById('monthGridLarge');
    const label = document.getElementById('monthViewLabel');
    if (!grid) return;

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    if (label) label.textContent = `${months[this.calViewMonth]} ${this.calViewYear}`;

    const tasks = this.getFilteredTasks();

    const firstDay = new Date(this.calViewYear, this.calViewMonth, 1).getDay();
    // Monday is index 0 in our grid, Sunday is index 6
    const startingBlankDays = (firstDay === 0 ? 6 : firstDay - 1);
    const totalDays = new Date(this.calViewYear, this.calViewMonth + 1, 0).getDate();

    let html = '';

    // Blank cells before the 1st
    for (let i = 0; i < startingBlankDays; i++) {
      const colIndex = i % 7;
      const isWeekend = (colIndex === 5 || colIndex === 6);
      html += `<div class="month-cell empty-day ${isWeekend ? 'weekend' : ''}"></div>`;
    }

    // Days 1 to totalDays
    for (let day = 1; day <= totalDays; day++) {
      const colIndex = (startingBlankDays + day - 1) % 7;
      const isWeekend = (colIndex === 5 || colIndex === 6);
      const dateStr = `${this.calViewYear}-${String(this.calViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = (this.calViewYear === 2026 && this.calViewMonth === 8 && (day === 27 || day === 28));

      // Match tasks starting or due on this date
      const dueTasks = tasks.filter(t => t.dueDate === dateStr);
      const startTasks = tasks.filter(t => t.startDate === dateStr && t.dueDate !== dateStr);

      const badges = [
        ...startTasks.map(t => `
          <div class="month-task-badge ${normalizeStatus(t.status)}" title="Inicio: ${this.escapeHTML(t.title)}" onclick="event.stopPropagation(); app.openEditModal('${t.id}')">
            <span class="badge-icon">▶</span>
            <span class="badge-title">${this.escapeHTML(t.title)}</span>
          </div>
        `),
        ...dueTasks.map(t => `
          <div class="month-task-badge ${normalizeStatus(t.status)}" title="Entrega: ${this.escapeHTML(t.title)}" onclick="event.stopPropagation(); app.openEditModal('${t.id}')">
            <span class="badge-icon">🏁</span>
            <span class="badge-title">${this.escapeHTML(t.title)}</span>
          </div>
        `)
      ].join('');

      html += `
        <div class="month-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" 
             onclick="app.openCreateModalOnDate('${dateStr}')" 
             title="Click para añadir tarea en ${dateStr}">
          <div class="month-cell-top">
            <span class="month-cell-num">${day}</span>
            ${isToday ? '<span class="today-tag">HOY</span>' : ''}
          </div>
          <div class="month-tasks-wrapper">
            ${badges}
          </div>
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  navMonthCalendar(dir) {
    this.calViewMonth += dir;
    if (this.calViewMonth < 0) {
      this.calViewMonth = 11;
      this.calViewYear -= 1;
    } else if (this.calViewMonth > 11) {
      this.calViewMonth = 0;
      this.calViewYear += 1;
    }
    this.renderMonthCalendarView();
  }

  resetMonthCalendarToday() {
    this.calViewYear = 2026;
    this.calViewMonth = 8;
    this.renderMonthCalendarView();
  }

  openCreateModalOnDate(dateStr) {
    this.openCreateModal('todo');
    const start = document.getElementById('formStartDate');
    const due = document.getElementById('formDueDate');
    if (start) start.value = dateStr;
    if (due) due.value = dateStr;
  }

  // ═════════════════════════════════════════════════════════════
  // CENTRAL HUB DASHBOARD (KANBAN.HTML)
  // ═════════════════════════════════════════════════════════════
  renderHubDashboard() {
    const allBoards = ['offszn', 'upc', 'pendientes'];
    let totalTasks = 0;
    let inProgressTasks = 0;
    let doneTasks = 0;
    let urgentTasks = 0;

    allBoards.forEach(bId => {
      const b = this.db[bId];
      if (b && b.tasks) {
        totalTasks += b.tasks.length;
        inProgressTasks += b.tasks.filter(t => normalizeStatus(t.status) === 'en-curso').length;
        doneTasks += b.tasks.filter(t => normalizeStatus(t.status) === 'listo').length;
        urgentTasks += b.tasks.filter(t => t.priority === 'urgent' && normalizeStatus(t.status) !== 'listo').length;
      }
    });

    const totalEl = document.getElementById('hubTotalTasks');
    const progEl = document.getElementById('hubInProgressTasks');
    const doneEl = document.getElementById('hubDoneTasks');
    const urgentEl = document.getElementById('hubUrgentTasks');

    if (totalEl) totalEl.textContent = totalTasks;
    if (progEl) progEl.textContent = inProgressTasks;
    if (doneEl) doneEl.textContent = doneTasks;
    if (urgentEl) urgentEl.textContent = urgentTasks;

    allBoards.forEach(bId => {
      const b = this.db[bId];
      if (b) {
        const pTotal = b.tasks.length;
        const pProg = b.tasks.filter(t => normalizeStatus(t.status) === 'en-curso').length;
        const pDone = b.tasks.filter(t => normalizeStatus(t.status) === 'listo').length;

        const elTotal = document.getElementById(`portal-${bId}-total`);
        const elProg = document.getElementById(`portal-${bId}-prog`);
        const elDone = document.getElementById(`portal-${bId}-done`);

        if (elTotal) elTotal.textContent = pTotal;
        if (elProg) elProg.textContent = pProg;
        if (elDone) elDone.textContent = pDone;
      }
    });

    const urgentListEl = document.getElementById('hubUrgentList');
    if (urgentListEl) {
      const urgentList = [];
      allBoards.forEach(bId => {
        const b = this.db[bId];
        if (b && b.tasks) {
          b.tasks.forEach(t => {
            if (normalizeStatus(t.status) !== 'listo') {
              urgentList.push({ ...t, boardName: b.title, boardId: bId });
            }
          });
        }
      });

      urgentList.sort((a, b) => (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : -1);

      urgentListEl.innerHTML = urgentList.slice(0, 6).map(t => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 1.15rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-card); border-radius: var(--radius-sm); gap: 0.75rem;">
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <span style="font-size: 0.9rem; font-weight: 700; color: #ffffff;">${this.escapeHTML(t.title)}</span>
            <span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-faint);">${t.boardName}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span class="priority-pill ${t.priority}">${t.priority}</span>
            <span style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted);">📅 ${t.dueDate ? this.formatShortDate(t.dueDate) : 'Sin fecha'}</span>
            <a href="kanban-${t.boardId}.html" class="btn-secondary" style="font-size: 0.74rem; padding: 0.28rem 0.65rem;">Ver ↗</a>
          </div>
        </div>
      `).join('');
    }
  }

  // ═════════════════════════════════════════════════════════════
  // EXACT DROPDOWNS.PNG REPLICA IMPLEMENTATION
  // ═════════════════════════════════════════════════════════════
  createGlobalPopovers() {
    if (document.getElementById('globalDropdownPopover')) return;

    // 1. Dropdown Popover (DROPDOWNS.png)
    const dropPopover = document.createElement('div');
    dropPopover.id = 'globalDropdownPopover';
    dropPopover.className = 'popover-dropdown';
    dropPopover.innerHTML = `
      <div class="dropdown-search-wrap">
        <span class="dropdown-search-icon">⌕</span>
        <input type="text" id="popoverSearchInput" class="dropdown-search-input" placeholder="Busca una opción..." oninput="app.filterDropdownOptions(this.value)">
      </div>
      <div class="dropdown-options-list" id="popoverOptionsList">
        <button type="button" class="dropdown-option" onclick="app.selectStatus('pendiente')">
          <span class="pill-option-status pendiente">Pendiente</span>
        </button>
        <button type="button" class="dropdown-option" onclick="app.selectStatus('en-curso')">
          <span class="pill-option-status en-curso">En curso</span>
        </button>
        <button type="button" class="dropdown-option" onclick="app.selectStatus('listo')">
          <span class="pill-option-status listo">Listo</span>
        </button>
        <button type="button" class="dropdown-option" onclick="app.selectStatus('pendiente')">
          <span class="option-none-text">Ninguno</span>
        </button>
      </div>
    `;
    document.body.appendChild(dropPopover);

    // 2. Calendar Popover (Tipodecalendario.png)
    const calPopover = document.createElement('div');
    calPopover.id = 'globalCalendarPopover';
    calPopover.className = 'popover-calendar';
    calPopover.innerHTML = `
      <div class="calendar-header">
        <div class="cal-month-year-group">
          <select id="calMonthSelect" class="cal-select" onchange="app.onCalendarMonthYearChange()">
            <option value="0">ene.</option>
            <option value="1">feb.</option>
            <option value="2">mar.</option>
            <option value="3">abr.</option>
            <option value="4">may.</option>
            <option value="5">jun.</option>
            <option value="6">jul.</option>
            <option value="7">ago.</option>
            <option value="8" selected>sep.</option>
            <option value="9">oct.</option>
            <option value="10">nov.</option>
            <option value="11">dic.</option>
          </select>
          <select id="calYearSelect" class="cal-select" onchange="app.onCalendarMonthYearChange()">
            <option value="2025">2025</option>
            <option value="2026" selected>2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
        <div class="cal-nav-arrows">
          <button type="button" class="cal-arrow-btn" onclick="app.navCalendarMonth(-1)">‹</button>
          <button type="button" class="cal-arrow-btn" onclick="app.navCalendarMonth(1)">›</button>
        </div>
      </div>

      <div class="calendar-weekdays">
        <div>lu</div><div>ma</div><div>mi</div><div>ju</div><div>vi</div><div>sá</div><div>do</div>
      </div>

      <div class="calendar-days-grid" id="calDaysGrid">
        <!-- Rendered via JS -->
      </div>

      <div class="calendar-footer">
        <button type="button" class="cal-btn-action" onclick="app.clearCalendarDate()">Borrar</button>
        <button type="button" class="cal-btn-action" onclick="app.setCalendarToday()">Hoy</button>
      </div>
    `;
    document.body.appendChild(calPopover);
  }

  openDropdownPopover(event, taskId) {
    event.stopPropagation();
    this.closeAllPopovers();

    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    const popover = document.getElementById('globalDropdownPopover');
    if (!popover) return;

    this.activeDropdown = { taskId, targetElement: trigger };

    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + 230 > window.innerWidth) {
      left = window.innerWidth - 240;
    }
    if (top + 190 > window.innerHeight) {
      top = rect.top - 190;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.add('visible');

    const search = document.getElementById('popoverSearchInput');
    if (search) {
      search.value = '';
      this.filterDropdownOptions('');
      setTimeout(() => search.focus(), 40);
    }
  }

  filterDropdownOptions(query) {
    const q = query.toLowerCase().trim();
    const list = document.getElementById('popoverOptionsList');
    if (!list) return;

    const options = list.querySelectorAll('.dropdown-option');
    options.forEach(opt => {
      const text = opt.textContent.toLowerCase();
      opt.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  selectStatus(newStatus) {
    if (!this.activeDropdown) return;
    const { taskId } = this.activeDropdown;

    const board = this.getBoardData();
    if (board) {
      const task = board.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
        saveKanbanDB(this.db);
        this.renderCurrentView();
      }
    }

    this.closeAllPopovers();
  }

  // ═════════════════════════════════════════════════════════════
  // EXACT TIPODECALENDARIO.PNG REPLICA IMPLEMENTATION
  // ═════════════════════════════════════════════════════════════
  openCalendarPopover(event, taskId, field) {
    event.stopPropagation();
    this.closeAllPopovers();

    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    const popover = document.getElementById('globalCalendarPopover');
    if (!popover) return;

    const board = this.getBoardData();
    const task = board ? board.tasks.find(t => t.id === taskId) : null;
    const currentDate = (task && task[field]) ? task[field] : '2026-09-28';

    let [year, month, day] = currentDate.split('-').map(Number);
    if (!year) {
      year = 2026;
      month = 9;
      day = 28;
    }

    this.activeCalendar = {
      taskId,
      field,
      targetElement: trigger,
      selectedDate: currentDate,
      viewMonth: month - 1,
      viewYear: year
    };

    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + 290 > window.innerWidth) {
      left = window.innerWidth - 300;
    }
    if (top + 290 > window.innerHeight) {
      top = rect.top - 290;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.add('visible');

    this.renderCalendarGrid();
  }

  renderCalendarGrid() {
    if (!this.activeCalendar) return;
    const { viewMonth, viewYear, selectedDate } = this.activeCalendar;

    const monthSelect = document.getElementById('calMonthSelect');
    const yearSelect = document.getElementById('calYearSelect');
    if (monthSelect) monthSelect.value = viewMonth;
    if (yearSelect) yearSelect.value = viewYear;

    const grid = document.getElementById('calDaysGrid');
    if (!grid) return;

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const startingBlanks = (firstDay === 0 ? 6 : firstDay - 1);
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

    let html = '';

    for (let i = 0; i < startingBlanks; i++) {
      html += `<div class="cal-day-cell empty"></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = (dateStr === selectedDate);
      const isToday = (viewYear === 2026 && viewMonth === 8 && (d === 27 || d === 28));

      html += `
        <button type="button" class="cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
          onclick="app.selectCalendarDate('${dateStr}')">
          ${d}
        </button>
      `;
    }

    grid.innerHTML = html;
  }

  onCalendarMonthYearChange() {
    if (!this.activeCalendar) return;
    const m = parseInt(document.getElementById('calMonthSelect').value, 10);
    const y = parseInt(document.getElementById('calYearSelect').value, 10);
    this.activeCalendar.viewMonth = m;
    this.activeCalendar.viewYear = y;
    this.renderCalendarGrid();
  }

  navCalendarMonth(dir) {
    if (!this.activeCalendar) return;
    let m = this.activeCalendar.viewMonth + dir;
    let y = this.activeCalendar.viewYear;

    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }

    this.activeCalendar.viewMonth = m;
    this.activeCalendar.viewYear = y;
    this.renderCalendarGrid();
  }

  selectCalendarDate(dateStr) {
    if (!this.activeCalendar) return;
    const { taskId, field } = this.activeCalendar;

    const board = this.getBoardData();
    if (board) {
      const task = board.tasks.find(t => t.id === taskId);
      if (task) {
        task[field] = dateStr;
        saveKanbanDB(this.db);
        this.renderCurrentView();
      }
    }

    this.closeAllPopovers();
  }

  clearCalendarDate() {
    if (!this.activeCalendar) return;
    const { taskId, field } = this.activeCalendar;

    const board = this.getBoardData();
    if (board) {
      const task = board.tasks.find(t => t.id === taskId);
      if (task) {
        task[field] = '';
        saveKanbanDB(this.db);
        this.renderCurrentView();
      }
    }

    this.closeAllPopovers();
  }

  setCalendarToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectCalendarDate(`${y}-${m}-${day}`);
  }

  closeAllPopovers() {
    const dropPopover = document.getElementById('globalDropdownPopover');
    const calPopover = document.getElementById('globalCalendarPopover');
    if (dropPopover) dropPopover.classList.remove('visible');
    if (calPopover) calPopover.classList.remove('visible');

    this.activeDropdown = null;
    this.activeCalendar = null;
  }

  // ═════════════════════════════════════════════════════════════
  // TASK MODAL (CREATE / EDIT)
  // ═════════════════════════════════════════════════════════════
  createTaskModal() {
    if (document.getElementById('taskModalBackdrop')) return;

    const modal = document.createElement('div');
    modal.id = 'taskModalBackdrop';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3 class="modal-title" id="modalTitle">Nueva Tarea</h3>
          <button type="button" class="modal-close-btn" onclick="app.closeModal()">✕</button>
        </div>

        <form class="modal-form" id="taskForm" onsubmit="app.handleFormSubmit(event)">
          <input type="hidden" id="formTaskId">

          <div class="form-group">
            <label class="form-label" for="formTitle">Título de la Tarea *</label>
            <input type="text" id="formTitle" class="form-input" required placeholder="Ej: Lanzar Vocal Preset en TikTok">
          </div>

          <div class="form-group">
            <label class="form-label" for="formDesc">Descripción o Notas</label>
            <textarea id="formDesc" class="form-textarea" placeholder="Detalles, enlaces, instrucciones o recordatorios..."></textarea>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label" for="formStatus">Estado</label>
              <select id="formStatus" class="form-select">
                <option value="pendiente" selected>⏳ Pendiente</option>
                <option value="en-curso">⚡ En curso</option>
                <option value="listo">✅ Listo</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="formPriority">Prioridad</label>
              <select id="formPriority" class="form-select">
                <option value="urgent">⚡ Urgente</option>
                <option value="high">▲ Alta</option>
                <option value="medium" selected>● Media</option>
                <option value="low">▼ Baja</option>
              </select>
            </div>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label" for="formStartDate">Fecha de Inicio</label>
              <input type="date" id="formStartDate" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label" for="formDueDate">Fecha de Finalización / Límite</label>
              <input type="date" id="formDueDate" class="form-input">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="formTags">Tags (separados por coma)</label>
            <input type="text" id="formTags" class="form-input" placeholder="Ej: Preset, Contenido, Marketing">
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar Tarea</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  openCreateModal(columnId = 'todo') {
    this.closeAllPopovers();
    const modal = document.getElementById('taskModalBackdrop');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('taskForm');

    if (modal && form) {
      form.reset();
      document.getElementById('formTaskId').value = '';
      document.getElementById('formStatus').value = normalizeStatus(columnId);
      document.getElementById('formStartDate').value = '2026-09-28';
      document.getElementById('formDueDate').value = '2026-10-05';
      if (title) title.textContent = 'Nueva Tarea';
      modal.classList.add('visible');
      setTimeout(() => document.getElementById('formTitle').focus(), 40);
    }
  }

  openEditModal(taskId) {
    this.closeAllPopovers();
    const board = this.getBoardData();
    if (!board) return;

    const task = board.tasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('taskModalBackdrop');
    const title = document.getElementById('modalTitle');

    if (modal) {
      document.getElementById('formTaskId').value = task.id;
      document.getElementById('formTitle').value = task.title;
      document.getElementById('formDesc').value = task.desc || '';
      document.getElementById('formStatus').value = normalizeStatus(task.status);
      document.getElementById('formPriority').value = task.priority || 'medium';
      document.getElementById('formStartDate').value = task.startDate || '';
      document.getElementById('formDueDate').value = task.dueDate || '';
      document.getElementById('formTags').value = (task.tags || []).join(', ');

      if (title) title.textContent = 'Editar Tarea';
      modal.classList.add('visible');
      setTimeout(() => document.getElementById('formTitle').focus(), 40);
    }
  }

  closeModal() {
    const modal = document.getElementById('taskModalBackdrop');
    if (modal) modal.classList.remove('visible');
  }

  handleFormSubmit(event) {
    event.preventDefault();
    const board = this.getBoardData();
    if (!board) return;

    const id = document.getElementById('formTaskId').value;
    const title = document.getElementById('formTitle').value.trim();
    const desc = document.getElementById('formDesc').value.trim();
    const status = normalizeStatus(document.getElementById('formStatus').value);
    const priority = document.getElementById('formPriority').value;
    const startDate = document.getElementById('formStartDate').value;
    const dueDate = document.getElementById('formDueDate').value;
    const tagsRaw = document.getElementById('formTags').value;
    const tags = tagsRaw.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);

    if (id) {
      const task = board.tasks.find(t => t.id === id);
      if (task) {
        task.title = title;
        task.desc = desc;
        task.status = status;
        task.priority = priority;
        task.startDate = startDate;
        task.dueDate = dueDate;
        task.tags = tags;
      }
    } else {
      const newTask = {
        id: `${this.boardId}-${Date.now()}`,
        title,
        desc,
        status,
        priority,
        startDate,
        dueDate,
        tags
      };
      board.tasks.unshift(newTask);
    }

    saveKanbanDB(this.db);
    this.closeModal();
    this.renderBoard();
  }

  deleteTask(taskId) {
    if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
    const board = this.getBoardData();
    if (board) {
      board.tasks = board.tasks.filter(t => t.id !== taskId);
      saveKanbanDB(this.db);
      this.renderBoard();
    }
  }

  // ═════════════════════════════════════════════════════════════
  // HOVER.DEV DRAG & DROP ENGINE (VIOLET INDICATORS & BURNBARREL)
  // Reference: www.hover.dev/components/boards#custom-kanban
  // ═════════════════════════════════════════════════════════════
  attachHoverDragEvents() {
    // 1. Cards dragstart & dragend
    const cards = document.querySelectorAll('.hover-card, .kanban-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        const id = card.getAttribute('data-id');
        this.draggedTaskId = id;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedTaskId = null;
        this.clearAllIndicators();
        document.querySelectorAll('.hover-col, .kanban-col').forEach(c => c.classList.remove('drag-active', 'drag-over'));
      });
    });

    // 2. Columns dragover, dragleave, drop
    const cols = document.querySelectorAll('.hover-col, .kanban-col');
    cols.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-active');
        this.highlightIndicator(e, col);
      });

      col.addEventListener('dragleave', (e) => {
        // Only trigger if actually leaving column boundary
        const rect = col.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
          col.classList.remove('drag-active');
          this.clearColumnIndicators(col);
        }
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-active');
        const colId = col.getAttribute('data-col');
        const cardId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;

        if (cardId && colId) {
          const indicators = Array.from(col.querySelectorAll('.drop-indicator'));
          const activeInd = indicators.find(i => i.classList.contains('active')) || indicators[indicators.length - 1];
          const beforeId = activeInd ? activeInd.getAttribute('data-before') : '-1';
          this.clearAllIndicators();
          this.moveTask(cardId, colId, beforeId);
        }
      });
    });

    // 3. Hover.dev BurnBarrel (Delete Drop Zone)
    const burnBarrel = document.getElementById('burnBarrel');
    if (burnBarrel) {
      burnBarrel.addEventListener('dragover', (e) => {
        e.preventDefault();
        burnBarrel.classList.add('active');
        e.dataTransfer.dropEffect = 'move';
      });

      burnBarrel.addEventListener('dragleave', () => {
        burnBarrel.classList.remove('active');
      });

      burnBarrel.addEventListener('drop', (e) => {
        e.preventDefault();
        burnBarrel.classList.remove('active');
        const cardId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
        if (cardId) {
          this.deleteTaskDirect(cardId);
        }
      });
    }
  }

  // Alias for backwards compatibility
  attachDragEvents() {
    this.attachHoverDragEvents();
  }

  highlightIndicator(e, colEl) {
    const indicators = Array.from(colEl.querySelectorAll('.drop-indicator'));
    indicators.forEach(i => i.classList.remove('active'));

    const nearest = this.getNearestIndicator(e, indicators);
    if (nearest) {
      nearest.classList.add('active');
    }
  }

  clearColumnIndicators(colEl) {
    const indicators = colEl.querySelectorAll('.drop-indicator');
    indicators.forEach(i => i.classList.remove('active'));
  }

  clearAllIndicators() {
    document.querySelectorAll('.drop-indicator').forEach(i => i.classList.remove('active'));
  }

  getNearestIndicator(e, indicators) {
    if (!indicators || indicators.length === 0) return null;
    const DISTANCE_OFFSET = 50;

    return indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - (box.top + DISTANCE_OFFSET);
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      {
        offset: Number.NEGATIVE_INFINITY,
        element: indicators[indicators.length - 1]
      }
    ).element;
  }

  moveTask(cardId, targetCol, beforeId) {
    const board = this.getBoardData();
    if (!board) return;

    const taskIndex = board.tasks.findIndex(t => t.id === cardId);
    if (taskIndex === -1) return;

    const [task] = board.tasks.splice(taskIndex, 1);
    task.status = targetCol;

    if (beforeId === '-1' || !beforeId) {
      let lastIndex = -1;
      for (let i = board.tasks.length - 1; i >= 0; i--) {
        if (normalizeStatus(board.tasks[i].status) === targetCol) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex === -1) {
        board.tasks.push(task);
      } else {
        board.tasks.splice(lastIndex + 1, 0, task);
      }
    } else {
      const beforeIndex = board.tasks.findIndex(t => t.id === beforeId);
      if (beforeIndex === -1) {
        board.tasks.push(task);
      } else {
        board.tasks.splice(beforeIndex, 0, task);
      }
    }

    saveKanbanDB(this.db);
    this.renderCurrentView();
  }

  deleteTaskDirect(cardId) {
    const board = this.getBoardData();
    if (!board) return;

    board.tasks = board.tasks.filter(t => t.id !== cardId);
    saveKanbanDB(this.db);
    this.renderCurrentView();

    // Burn animation trigger
    const barrel = document.getElementById('burnBarrel');
    if (barrel) {
      barrel.classList.add('active');
      setTimeout(() => barrel.classList.remove('active'), 600);
    }
  }

  handleSearch(val) {
    this.searchQuery = val;
    this.renderCurrentView();
  }

  setStatusFilter(status) {
    this.filterStatus = status;
    this.renderCurrentView();
  }

  setPriorityFilter(priority) {
    this.filterPriority = priority;
    this.renderCurrentView();
  }

  setTagFilter(tag) {
    this.selectedTag = tag;
    this.renderTagChips();
    this.renderCurrentView();
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterPriority = 'all';
    this.selectedTag = 'all';

    const searchInput = document.getElementById('boardSearchInput');
    const statusSelect = document.getElementById('filterStatusSelect');
    const prioritySelect = document.getElementById('filterPrioritySelect');

    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (prioritySelect) prioritySelect.value = 'all';

    this.renderTagChips();
    this.renderCurrentView();
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });
    this.renderCurrentView();
  }

  scrollToColumn(colId) {
    const col = document.querySelector(`.hover-col[data-col="${colId}"], .kanban-col[data-col="${colId}"]`);
    if (col) {
      col.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      document.querySelectorAll('.mobile-col-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.toLowerCase().includes(colId));
      });
    }
  }

  onCardClick(event, taskId) {
    if (!event.target.closest('button')) {
      this.openEditModal(taskId);
    }
  }

  setupGlobalEvents() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.popover-dropdown') && !e.target.closest('.status-dropdown-trigger')) {
        const dropPopover = document.getElementById('globalDropdownPopover');
        if (dropPopover) dropPopover.classList.remove('visible');
      }
      if (!e.target.closest('.popover-calendar') && !e.target.closest('.date-trigger-btn')) {
        const calPopover = document.getElementById('globalCalendarPopover');
        if (calPopover) calPopover.classList.remove('visible');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllPopovers();
        this.closeModal();
      }
    });
  }

  formatShortDate(dStr) {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length < 3) return dStr;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const d = parseInt(parts[2], 10);
    const m = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${d} ${m}`;
  }

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
