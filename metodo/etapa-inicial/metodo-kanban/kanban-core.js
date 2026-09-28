/**
 * OFFSZN KANBAN SUITE • CORE ENGINE (v2.0 Elite Redesign)
 * Pixel-perfect DROPDOWNS.png & Tipodecalendario.png replicas,
 * high-contrast visual calendar, Linear/Notion table & drag-and-drop kanban.
 */

const STORAGE_KEY = 'OFFSZN_KANBAN_DATABASE_V3';

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

    // Calendar view state (Fixed to Sep 2026 for reference consistency)
    this.calViewYear = 2026;
    this.calViewMonth = 8; // 0-indexed: 8 is September

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

  renderHubDashboard() {
    const boards = ['offszn', 'upc', 'pendientes'];
    let totalTasks = 0;
    let urgentTasks = 0;
    let inProgressTasks = 0;
    let doneTasks = 0;
    let allActiveTasks = [];

    boards.forEach(bId => {
      const b = this.db[bId];
      if (!b) return;
      const tasks = b.tasks || [];
      const total = tasks.length;
      const prog = tasks.filter(t => t.status === 'en-curso').length;
      const done = tasks.filter(t => t.status === 'listo').length;
      const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'listo').length;

      totalTasks += total;
      urgentTasks += urgent;
      inProgressTasks += prog;
      doneTasks += done;

      tasks.forEach(t => {
        if (t.status !== 'listo') {
          allActiveTasks.push({ ...t, boardId: bId, boardName: b.title });
        }
      });

      const elTot = document.getElementById(`portal-${bId}-total`);
      const elProg = document.getElementById(`portal-${bId}-prog`);
      const elDone = document.getElementById(`portal-${bId}-done`);
      if (elTot) elTot.textContent = total;
      if (elProg) elProg.textContent = prog;
      if (elDone) elDone.textContent = done;
    });

    const elGTot = document.getElementById('global-total-tasks');
    const elGUrg = document.getElementById('global-urgent-tasks');
    const elGProg = document.getElementById('global-in-progress');
    const elGDone = document.getElementById('global-done-tasks');
    if (elGTot) elGTot.textContent = totalTasks;
    if (elGUrg) elGUrg.textContent = urgentTasks;
    if (elGProg) elGProg.textContent = inProgressTasks;
    if (elGDone) elGDone.textContent = doneTasks;

    const urgentContainer = document.getElementById('hubUrgentList');
    if (urgentContainer) {
      if (allActiveTasks.length === 0) {
        urgentContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem; color: var(--text-faint);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-secondary);">No hay tareas pendientes en ningún tablero</div>
            <p style="font-size: 0.8rem; margin-top: 0.35rem; color: var(--text-muted);">Ingresa a cualquiera de los 3 tableros para añadir tus proyectos reales.</p>
          </div>
        `;
      } else {
        allActiveTasks.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });

        urgentContainer.innerHTML = allActiveTasks.slice(0, 6).map(t => {
          const boardTag = t.boardId === 'offszn' ? '🔥 OFFSZN' : (t.boardId === 'upc' ? '🎓 UPC' : '🎧 ESTUDIO');
          const pMeta = {
            urgent: { label: '⚡ Urgente', color: '#f87171', bg: 'rgba(239, 68, 68, 0.1)' },
            high: { label: '▲ Alta', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.1)' },
            medium: { label: '● Media', color: '#facc15', bg: 'rgba(234, 179, 8, 0.1)' },
            low: { label: '▼ Baja', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.1)' }
          }[t.priority] || { label: '● Media', color: '#facc15', bg: 'rgba(234, 179, 8, 0.1)' };

          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); padding: 0.2rem 0.5rem; background: var(--bg-subtle); border-radius: 4px;">${boardTag}</span>
                <span style="font-weight: 600; color: #fff; font-size: 0.9rem;">${this.escapeHTML(t.title)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 999px; color: ${pMeta.color}; background: ${pMeta.bg}; font-weight: 600;">${pMeta.label}</span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);">🏁 ${t.dueDate ? this.formatShortDate(t.dueDate) : 'Sin fecha'}</span>
                <a href="kanban-${t.boardId}.html" style="font-size: 0.8rem; color: var(--text-link); text-decoration: none; font-weight: 600;">Abrir →</a>
              </div>
            </div>
          `;
        }).join('');
      }
    }
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
      tasks = tasks.filter(t => t.status === this.filterStatus);
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
  // KANBAN COLUMNS & CARDS
  // ═════════════════════════════════════════════════════════════
  renderKanbanColumns() {
    const tasks = this.getFilteredTasks();

    const columns = [
      { id: 'pendiente', name: 'Pendiente', indicator: 'pending' },
      { id: 'en-curso', name: 'En curso', indicator: 'in-progress' },
      { id: 'listo', name: 'Listo', indicator: 'done' }
    ];

    const mobileTabs = document.getElementById('mobileColumnTabs');
    if (mobileTabs) {
      mobileTabs.innerHTML = columns.map(c => {
        const count = tasks.filter(t => t.status === c.id).length;
        return `<button type="button" class="mobile-col-btn" onclick="app.scrollToColumn('${c.id}')">
          <span class="col-indicator ${c.indicator}"></span> ${c.name} (${count})
        </button>`;
      }).join('');
    }

    columns.forEach(col => {
      const colCards = tasks.filter(t => t.status === col.id);
      const countEl = document.getElementById(`count-${col.id}`);
      const listEl = document.getElementById(`list-${col.id}`);

      if (countEl) countEl.textContent = colCards.length;
      if (listEl) {
        if (colCards.length === 0) {
          listEl.innerHTML = `
            <div class="col-empty-card">
              <span class="empty-icon">📂</span>
              <p class="empty-text">Sin tareas en ${col.name}</p>
              <button type="button" class="empty-add-btn" onclick="app.openCreateModal('${col.id}')">+ Añadir tarea</button>
            </div>`;
        } else {
          listEl.innerHTML = colCards.map(t => this.createCardHTML(t)).join('');
        }
      }
    });

    this.attachDragEvents();
  }

  createCardHTML(task) {
    const priorityMeta = {
      urgent: { label: '⚡ Urgente', class: 'urgent' },
      high: { label: '▲ Alta', class: 'high' },
      medium: { label: '● Media', class: 'medium' },
      low: { label: '▼ Baja', class: 'low' }
    };

    const statusLabels = {
      'pendiente': 'Pendiente',
      'en-curso': 'En curso',
      'listo': 'Listo'
    };

    const tagsHtml = (task.tags || []).map(tg => `<span class="card-tag">#${tg}</span>`).join('');

    const startFormatted = task.startDate ? this.formatShortDate(task.startDate) : 'Inicio';
    const dueFormatted = task.dueDate ? this.formatShortDate(task.dueDate) : 'Finalización';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date('2026-09-27') && task.status !== 'listo';

    const pMeta = priorityMeta[task.priority] || priorityMeta.medium;
    const taskCode = (task.id || '').toUpperCase();
    const avatarInitials = this.boardId === 'offszn' ? 'OF' : (this.boardId === 'upc' ? 'UP' : 'WK');

    return `
      <div class="kanban-card" draggable="true" data-id="${task.id}" onclick="app.onCardClick(event, '${task.id}')">
        <div class="card-top">
          <div class="card-top-left">
            <span class="priority-pill ${pMeta.class}">
              ${pMeta.label}
            </span>
            <span class="card-id-badge">#${taskCode}</span>
          </div>
          <div class="card-top-right">
            <button type="button" class="card-menu-btn" title="Editar tarea" onclick="event.stopPropagation(); app.openEditModal('${task.id}')">✎</button>
            <button type="button" class="card-menu-btn delete-btn" title="Eliminar tarea" onclick="event.stopPropagation(); app.deleteTask('${task.id}')">✕</button>
          </div>
        </div>

        <div class="card-title">${this.escapeHTML(task.title)}</div>
        ${task.desc ? `<div class="card-desc">${this.escapeHTML(task.desc)}</div>` : ''}

        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}

        <div class="card-dates-row">
          <button type="button" class="date-trigger-btn ${task.startDate ? 'has-date' : ''}" 
            title="Seleccionar Fecha de Inicio" onclick="event.stopPropagation(); app.openCalendarPopover(event, '${task.id}', 'startDate')">
            📅 ${startFormatted}
          </button>
          <span style="color: var(--text-faint); font-size: 0.72rem;">→</span>
          <button type="button" class="date-trigger-btn ${task.dueDate ? 'has-date' : ''} ${isOverdue ? 'overdue' : ''}" 
            title="Seleccionar Fecha de Finalización / Máxima" onclick="event.stopPropagation(); app.openCalendarPopover(event, '${task.id}', 'dueDate')">
            🏁 ${dueFormatted} ${isOverdue ? '<span class="overdue-dot" title="Vencido">!</span>' : ''}
          </button>
        </div>

        <div class="card-footer">
          <button type="button" class="status-dropdown-trigger ${task.status || 'pendiente'}" 
            title="Cambiar estado" onclick="event.stopPropagation(); app.openDropdownPopover(event, '${task.id}')">
            ● ${statusLabels[task.status] || 'Pendiente'} ▾
          </button>
          <div class="card-footer-right">
            <span class="assignee-avatar" title="Responsable: ${this.boardId.toUpperCase()} Team">${avatarInitials}</span>
          </div>
        </div>
      </div>
    `;
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

    const statusLabels = { 'pendiente': 'Pendiente', 'en-curso': 'En curso', 'listo': 'Listo' };

    tbody.innerHTML = tasks.map(t => {
      const pMeta = priorityMeta[t.priority] || priorityMeta.medium;
      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date('2026-09-27') && t.status !== 'listo';

      return `
        <tr>
          <td style="font-weight: 600; color: #ffffff; max-width: 340px;">
            <div style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="app.openEditModal('${t.id}')">
              <span class="card-id-badge">#${(t.id || '').toUpperCase()}</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHTML(t.title)}</span>
            </div>
          </td>
          <td>
            <button type="button" class="status-dropdown-trigger ${t.status}" onclick="app.openDropdownPopover(event, '${t.id}')">
              ● ${statusLabels[t.status]} ▾
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
          <div class="month-task-badge ${t.status}" title="Inicio: ${this.escapeHTML(t.title)}" onclick="event.stopPropagation(); app.openEditModal('${t.id}')">
            <span class="badge-icon">▶</span>
            <span class="badge-title">${this.escapeHTML(t.title)}</span>
          </div>
        `),
        ...dueTasks.map(t => `
          <div class="month-task-badge ${t.status}" title="Entrega: ${this.escapeHTML(t.title)}" onclick="event.stopPropagation(); app.openEditModal('${t.id}')">
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
    this.openCreateModal('pendiente');
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
        inProgressTasks += b.tasks.filter(t => t.status === 'en-curso').length;
        doneTasks += b.tasks.filter(t => t.status === 'listo').length;
        urgentTasks += b.tasks.filter(t => t.priority === 'urgent' && t.status !== 'listo').length;
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
        const pProg = b.tasks.filter(t => t.status === 'en-curso').length;
        const pDone = b.tasks.filter(t => t.status === 'listo').length;

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
            if (t.status !== 'listo') {
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
    this.selectCalendarDate('2026-09-28');
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
                <option value="pendiente">Pendiente</option>
                <option value="en-curso">En curso</option>
                <option value="listo">Listo</option>
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

  openCreateModal(columnId = 'pendiente') {
    this.closeAllPopovers();
    const modal = document.getElementById('taskModalBackdrop');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('taskForm');

    if (modal && form) {
      form.reset();
      document.getElementById('formTaskId').value = '';
      document.getElementById('formStatus').value = columnId;
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
      document.getElementById('formStatus').value = task.status || 'pendiente';
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
    const status = document.getElementById('formStatus').value;
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
  // DRAG & DROP
  // ═════════════════════════════════════════════════════════════
  attachDragEvents() {
    const cards = document.querySelectorAll('.kanban-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.draggedTaskId = card.getAttribute('data-id');
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', this.draggedTaskId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.draggedTaskId = null;
      });
    });

    const columns = document.querySelectorAll('.kanban-col');
    columns.forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        col.classList.remove('drag-over');
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const colId = col.getAttribute('data-col');
        if (this.draggedTaskId && colId) {
          const board = this.getBoardData();
          if (board) {
            const task = board.tasks.find(t => t.id === this.draggedTaskId);
            if (task && task.status !== colId) {
              task.status = colId;
              saveKanbanDB(this.db);
              this.renderCurrentView();
            }
          }
        }
      });
    });
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
    const col = document.querySelector(`.kanban-col[data-col="${colId}"]`);
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
