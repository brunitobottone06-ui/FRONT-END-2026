/**
 * ============================================================
 * POSTVAULT — app.js
 * CRUD Dashboard · JSONPlaceholder API · Vanilla ES6+
 * ============================================================
 *
 * Arquitectura modular (sin frameworks):
 *   - API_SERVICE  : funciones de comunicación con la REST API
 *   - STATE        : estado central de la aplicación
 *   - RENDER       : funciones de renderizado del DOM
 *   - TOAST        : sistema de notificaciones
 *   - MODAL        : diálogo de confirmación
 *   - FORM         : lógica del formulario (crear / editar)
 *   - FILTER       : búsqueda y filtrado de posts
 *   - PAGINATION   : lógica de páginas
 *   - INIT         : arranque de la aplicación
 * ============================================================
 */

'use strict';

/* ============================================================
   ██████╗  ██████╗ ███╗   ██╗███████╗██╗ ██████╗ 
   ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ 
   ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
   ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
   ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
    ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝ 
   ============================================================ */

const API_BASE = 'https://jsonplaceholder.typicode.com';
const RESOURCE  = '/posts';

/**
 * Realiza una petición HTTP genérica y maneja errores de red.
 * @param {string} endpoint - Ruta relativa (ej. "/posts/1")
 * @param {object} options  - Opciones de fetch (method, body, headers...)
 * @returns {Promise<any>}  - Datos JSON de la respuesta
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders = { 'Content-Type': 'application/json; charset=UTF-8' };

  const response = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...(options.headers || {}) },
  });

  // Si la respuesta no es OK lanzamos un error con el status
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${response.statusText}`);
  }

  // Las operaciones DELETE devuelven {} en JSONPlaceholder
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/* ── API SERVICE ────────────────────────────────────────────── */
const ApiService = {
  /** GET /posts — Obtiene todos los posts */
  getAllPosts: () => request(RESOURCE),

  /** POST /posts — Crea un nuevo post */
  createPost: (data) =>
    request(RESOURCE, { method: 'POST', body: JSON.stringify(data) }),

  /** PUT /posts/:id — Reemplaza un post completo */
  updatePost: (id, data) =>
    request(`${RESOURCE}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** DELETE /posts/:id — Elimina un post */
  deletePost: (id) =>
    request(`${RESOURCE}/${id}`, { method: 'DELETE' }),
};

/* ============================================================
   ███████╗████████╗ █████╗ ████████╗███████╗
   ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝
   ███████╗   ██║   ███████║   ██║   █████╗  
   ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝  
   ███████║   ██║   ██║  ██║   ██║   ███████╗
   ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝
   ============================================================ */

/**
 * Estado central de la aplicación (fuente única de verdad).
 * Evitamos variables globales sueltas: todo vive aquí.
 */
const State = {
  allPosts:     [],   // Todos los posts cargados de la API
  filteredPosts: [],  // Posts después de aplicar filtros
  currentPage:  1,    // Página actual
  postsPerPage: 9,    // Posts por página
  searchQuery:  '',   // Texto de búsqueda
  userFilter:   '',   // Filtro por userId
  editingId:    null, // ID del post en edición (null = modo crear)
};

/* ============================================================
   ████████╗ ██████╗  █████╗ ███████╗████████╗
      ██║   ██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝
      ██║   ██║   ██║███████║███████╗   ██║   
      ██║   ██║   ██║██╔══██║╚════██║   ██║   
      ██║   ╚██████╔╝██║  ██║███████║   ██║   
      ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   
   ============================================================ */

/**
 * Muestra u oculta pantallas de estado (loading / error / empty).
 * @param {'loading'|'error'|'empty'|'content'} screen
 */
function showScreen(screen) {
  const loading = document.getElementById('loading-screen');
  const error   = document.getElementById('error-screen');
  const empty   = document.getElementById('empty-screen');
  const grid    = document.getElementById('posts-grid');
  const pager   = document.getElementById('pagination');

  // Ocultar todo
  [loading, error, empty].forEach(el => el.hidden = true);
  grid.style.display  = '';
  pager.style.display = '';

  if (screen === 'loading') {
    loading.hidden      = false;
    grid.style.display  = 'none';
    pager.style.display = 'none';
  } else if (screen === 'error') {
    error.hidden        = false;
    grid.style.display  = 'none';
    pager.style.display = 'none';
  } else if (screen === 'empty') {
    empty.hidden        = false;
    grid.style.display  = 'none';
    pager.style.display = 'none';
  }
}

/**
 * Actualiza el contador de posts en el header.
 * @param {number} total
 */
function updateStatChip(total) {
  document.getElementById('stat-total').querySelector('.stat-num').textContent = total;
}

/**
 * Renderiza las tarjetas de posts en el grid.
 * @param {Array} posts - Posts a renderizar en la página actual
 */
function renderPosts(posts) {
  const grid = document.getElementById('posts-grid');
  grid.innerHTML = '';

  if (!posts.length) {
    showScreen('empty');
    return;
  }

  showScreen('content');

  // Calculamos el slice de la página actual
  const { currentPage, postsPerPage } = State;
  const start = (currentPage - 1) * postsPerPage;
  const end   = start + postsPerPage;
  const pagePosts = posts.slice(start, end);

  pagePosts.forEach((post, index) => {
    const card = createPostCard(post, index);
    grid.appendChild(card);
  });

  renderPagination(posts.length);
}

/**
 * Crea el elemento DOM de una tarjeta de post.
 * @param {object} post  - Datos del post
 * @param {number} index - Índice para staggered animation
 * @returns {HTMLElement}
 */
function createPostCard(post, index) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.setAttribute('role', 'listitem');
  card.dataset.postId = post.id;
  // Retraso escalonado en la animación de entrada
  card.style.animationDelay = `${index * 40}ms`;

  card.innerHTML = `
    <div class="card-meta">
      <span class="card-id">#${String(post.id).padStart(3, '0')}</span>
      <span class="card-user">user_${post.userId}</span>
    </div>
    <h3 class="card-title">${escapeHtml(capitalizeFirst(post.title))}</h3>
    <p class="card-body">${escapeHtml(post.body)}</p>
    <footer class="card-footer">
      <button
        class="btn btn-edit"
        data-action="edit"
        data-id="${post.id}"
        aria-label="Editar post ${post.id}"
      >✎ Editar</button>
      <button
        class="btn btn-delete"
        data-action="delete"
        data-id="${post.id}"
        aria-label="Eliminar post ${post.id}"
      >✕ Eliminar</button>
    </footer>
  `;

  return card;
}

/**
 * Rellena el select de filtro por usuario con valores únicos.
 * @param {Array} posts
 */
function populateUserFilter(posts) {
  const select = document.getElementById('filter-user');
  const userIds = [...new Set(posts.map(p => p.userId))].sort((a, b) => a - b);

  // Mantenemos la opción "Todos"
  select.innerHTML = '<option value="">Todos los usuarios</option>';
  userIds.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `Usuario ${id}`;
    select.appendChild(opt);
  });
}

/* ============================================================
   ██████╗  █████╗  ██████╗ ██╗███╗   ██╗ █████╗ 
   ██╔══██╗██╔══██╗██╔════╝ ██║████╗  ██║██╔══██╗
   ██████╔╝███████║██║  ███╗██║██╔██╗ ██║███████║
   ██╔═══╝ ██╔══██║██║   ██║██║██║╚██╗██║██╔══██║
   ██║     ██║  ██║╚██████╔╝██║██║ ╚████║██║  ██║
   ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
   ============================================================ */

/**
 * Renderiza los controles de paginación.
 * @param {number} totalPosts - Total de posts filtrados
 */
function renderPagination(totalPosts) {
  const pager      = document.getElementById('pagination');
  const totalPages = Math.ceil(totalPosts / State.postsPerPage);

  pager.innerHTML = '';
  if (totalPages <= 1) return;

  // Botón "anterior"
  const prevBtn = createPageBtn('‹', State.currentPage === 1, () => {
    State.currentPage--;
    renderPosts(State.filteredPosts);
    scrollToGrid();
  });
  pager.appendChild(prevBtn);

  // Páginas numéricas (con elipsis si hay muchas)
  const pages = getPaginationRange(State.currentPage, totalPages);
  pages.forEach(page => {
    if (page === '…') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-btn';
      ellipsis.textContent = '…';
      ellipsis.style.pointerEvents = 'none';
      pager.appendChild(ellipsis);
      return;
    }

    const btn = createPageBtn(page, false, () => {
      State.currentPage = page;
      renderPosts(State.filteredPosts);
      scrollToGrid();
    });
    if (page === State.currentPage) btn.classList.add('active');
    pager.appendChild(btn);
  });

  // Botón "siguiente"
  const nextBtn = createPageBtn('›', State.currentPage === totalPages, () => {
    State.currentPage++;
    renderPosts(State.filteredPosts);
    scrollToGrid();
  });
  pager.appendChild(nextBtn);
}

/**
 * Crea un botón de página.
 * @param {string|number} label
 * @param {boolean} disabled
 * @param {Function} onClick
 */
function createPageBtn(label, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className    = 'page-btn';
  btn.textContent  = label;
  btn.disabled     = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Genera el array de páginas con elipsis inteligente.
 * @param {number} current
 * @param {number} total
 * @returns {Array<number|string>}
 */
function getPaginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range = [];
  if (current <= 4) {
    range.push(1, 2, 3, 4, 5, '…', total);
  } else if (current >= total - 3) {
    range.push(1, '…', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    range.push(1, '…', current - 1, current, current + 1, '…', total);
  }
  return range;
}

function scrollToGrid() {
  document.getElementById('posts-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ============================================================
   ████████╗ ██████╗  █████╗ ███████╗████████╗
      ██║   ██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝
      ██║   ██║   ██║███████║███████╗   ██║   
      ██║   ██║   ██║██╔══██║╚════██║   ██║   
      ██║   ╚██████╔╝██║  ██║███████║   ██║   
      ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   
    TOAST & MODAL
   ============================================================ */

/**
 * Muestra una notificación toast.
 * @param {string} message  - Texto del mensaje
 * @param {'success'|'error'|'info'} type - Tipo visual
 * @param {number} duration - Duración en ms (default 3500)
 */
function showToast(message, type = 'success', duration = 3500) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

/**
 * Abre el modal de confirmación antes de eliminar.
 * @param {number|string} postId - ID del post a eliminar
 * @returns {Promise<boolean>}   - true si el usuario confirma
 */
function openConfirmModal(postId) {
  return new Promise((resolve) => {
    const modal   = document.getElementById('confirm-modal');
    const confirm = document.getElementById('modal-confirm');
    const cancel  = document.getElementById('modal-cancel');
    const body    = document.getElementById('modal-body');

    body.textContent = `¿Seguro que deseas eliminar el post #${postId}? Esta acción no puede deshacerse.`;
    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      confirm.removeEventListener('click', onConfirm);
      cancel.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel  = () => cleanup(false);

    confirm.addEventListener('click', onConfirm);
    cancel.addEventListener('click', onCancel);

    // Cerrar con ESC
    const onKeydown = (e) => {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKeydown); }
    };
    document.addEventListener('keydown', onKeydown);
  });
}

/* ============================================================
   ███████╗██╗██╗  ████████╗███████╗██████╗ 
   ██╔════╝██║██║  ╚══██╔══╝██╔════╝██╔══██╗
   █████╗  ██║██║     ██║   █████╗  ██████╔╝
   ██╔══╝  ██║██║     ██║   ██╔══╝  ██╔══██╗
   ██║     ██║███████╗██║   ███████╗██║  ██║
   ╚═╝     ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝
   ============================================================ */

/**
 * Aplica los filtros actuales (búsqueda + usuario) y re-renderiza.
 */
function applyFilters() {
  const query  = State.searchQuery.toLowerCase().trim();
  const userId = State.userFilter ? Number(State.userFilter) : null;

  State.filteredPosts = State.allPosts.filter(post => {
    const matchText = !query ||
      post.title.toLowerCase().includes(query) ||
      post.body.toLowerCase().includes(query);

    const matchUser = !userId || post.userId === userId;

    return matchText && matchUser;
  });

  // Volvemos a la página 1 al filtrar
  State.currentPage = 1;
  renderPosts(State.filteredPosts);
  updateStatChip(State.filteredPosts.length);
}

/* ============================================================
   ███████╗ ██████╗ ██████╗ ███╗   ███╗
   ██╔════╝██╔═══██╗██╔══██╗████╗ ████║
   █████╗  ██║   ██║██████╔╝██╔████╔██║
   ██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║
   ██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║
   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝
   ============================================================ */

/**
 * Valida todos los campos del formulario.
 * @returns {boolean} - true si el formulario es válido
 */
function validateForm() {
  let valid = true;

  const fields = [
    {
      id:    'post-userId',
      errId: 'error-userId',
      rules: [
        { test: v => v.trim() !== '',      msg: 'El User ID es obligatorio.' },
        { test: v => Number(v) >= 1 && Number(v) <= 10, msg: 'Debe ser un número del 1 al 10.' },
      ],
    },
    {
      id:    'post-title',
      errId: 'error-title',
      rules: [
        { test: v => v.trim() !== '',      msg: 'El título es obligatorio.' },
        { test: v => v.trim().length >= 5, msg: 'El título debe tener al menos 5 caracteres.' },
      ],
    },
    {
      id:    'post-body',
      errId: 'error-body',
      rules: [
        { test: v => v.trim() !== '',       msg: 'El contenido es obligatorio.' },
        { test: v => v.trim().length >= 10, msg: 'El contenido debe tener al menos 10 caracteres.' },
      ],
    },
  ];

  fields.forEach(({ id, errId, rules }) => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(errId);
    const value = input.value;
    let fieldMsg = '';

    for (const rule of rules) {
      if (!rule.test(value)) { fieldMsg = rule.msg; break; }
    }

    if (fieldMsg) {
      input.classList.add('has-error');
      errEl.textContent = fieldMsg;
      valid = false;
    } else {
      input.classList.remove('has-error');
      errEl.textContent = '';
    }
  });

  return valid;
}

/**
 * Pone el formulario en modo "edición" autocomplentando los campos.
 * @param {object} post - Post a editar
 */
function enterEditMode(post) {
  State.editingId = post.id;

  // Actualizar UI del formulario
  document.getElementById('form-title').textContent = 'Editar Post';
  document.getElementById('form-mode-badge').textContent = 'EDIT';
  document.getElementById('form-mode-badge').classList.add('mode-edit');
  document.getElementById('api-endpoint-current').textContent = `PUT /posts/${post.id}`;
  document.getElementById('submit-btn').querySelector('.btn-text').textContent = 'Guardar Cambios';
  document.getElementById('submit-btn').querySelector('.btn-icon').textContent = '✔';
  document.getElementById('cancel-btn').hidden = false;

  // Autocompletar campos
  document.getElementById('post-id').value     = post.id;
  document.getElementById('post-userId').value = post.userId;
  document.getElementById('post-title').value  = post.title;
  document.getElementById('post-body').value   = post.body;

  // Actualizar contadores
  updateCharCount('post-title', 'title-count', 120);
  updateCharCount('post-body', 'body-count', 500);

  // Scroll suave al formulario en móvil
  document.querySelector('.sidebar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Resetea el formulario a modo "crear".
 */
function exitEditMode() {
  State.editingId = null;

  document.getElementById('form-title').textContent = 'Nuevo Post';
  document.getElementById('form-mode-badge').textContent = 'CREATE';
  document.getElementById('form-mode-badge').classList.remove('mode-edit');
  document.getElementById('api-endpoint-current').textContent = 'POST /posts';
  document.getElementById('submit-btn').querySelector('.btn-text').textContent = 'Crear Post';
  document.getElementById('submit-btn').querySelector('.btn-icon').textContent = '✦';
  document.getElementById('cancel-btn').hidden = true;

  document.getElementById('post-form').reset();
  document.getElementById('title-count').textContent = '0 / 120';
  document.getElementById('body-count').textContent  = '0 / 500';

  // Limpiar errores
  ['error-userId', 'error-title', 'error-body'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['post-userId', 'post-title', 'post-body'].forEach(id => {
    document.getElementById(id).classList.remove('has-error');
  });
}

/**
 * Actualiza el contador de caracteres de un campo de texto.
 * @param {string} inputId   - ID del campo
 * @param {string} counterId - ID del elemento contador
 * @param {number} max       - Límite de caracteres
 */
function updateCharCount(inputId, counterId, max) {
  const len = document.getElementById(inputId).value.length;
  const el  = document.getElementById(counterId);
  el.textContent = `${len} / ${max}`;
  el.style.color = len > max * 0.9 ? 'var(--danger)' : '';
}

/* ============================================================
   ██╗     ██████╗  █████╗ ██████╗ ███████╗██████╗ 
   ██║    ██╔═══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗
   ██║    ██║   ██║███████║██║  ██║█████╗  ██████╔╝
   ██║    ██║   ██║██╔══██║██║  ██║██╔══╝  ██╔══██╗
   ███████╗╚██████╔╝██║  ██║██████╔╝███████╗██║  ██║
   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝
   ============================================================ */

/**
 * Carga todos los posts desde la API y actualiza el estado.
 */
async function loadPosts() {
  showScreen('loading');

  try {
    const posts = await ApiService.getAllPosts();
    State.allPosts = posts;
    populateUserFilter(posts);
    applyFilters();
    showToast(`${posts.length} posts cargados correctamente`, 'success');
  } catch (err) {
    console.error('[PostVault] Error al cargar posts:', err);
    showScreen('error');
    document.getElementById('error-message').textContent =
      `No se pudo conectar con la API: ${err.message}`;
    showToast('Error al cargar los posts', 'error');
  }
}

/**
 * Maneja el envío del formulario (crear o actualizar).
 * @param {SubmitEvent} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn = document.getElementById('submit-btn');
  const payload = {
    userId: Number(document.getElementById('post-userId').value),
    title:  document.getElementById('post-title').value.trim(),
    body:   document.getElementById('post-body').value.trim(),
  };

  // Estado de carga en el botón
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');

  try {
    if (State.editingId) {
      /* ── UPDATE (PUT) ── */
      const updated = await ApiService.updatePost(State.editingId, {
        ...payload,
        id: State.editingId,
      });

      // Actualizamos el post en el estado local
      const idx = State.allPosts.findIndex(p => p.id === State.editingId);
      if (idx !== -1) {
        State.allPosts[idx] = { ...State.allPosts[idx], ...payload };
      }

      applyFilters();

      // Efecto visual en la tarjeta editada
      setTimeout(() => {
        const card = document.querySelector(`[data-post-id="${State.editingId}"]`);
        if (card) card.classList.add('just-edited');
      }, 100);

      showToast(`Post #${State.editingId} actualizado correctamente`, 'success');
      exitEditMode();

    } else {
      /* ── CREATE (POST) ── */
      const created = await ApiService.createPost(payload);

      // JSONPlaceholder devuelve id:101 siempre (es un fake)
      // Lo añadimos al inicio con un ID temporal único
      const fakeId = Date.now();
      const newPost = { ...payload, id: fakeId };
      State.allPosts.unshift(newPost);
      applyFilters();

      showToast(`Post creado con ID #${fakeId} (simulado)`, 'success');
      exitEditMode();
    }

  } catch (err) {
    console.error('[PostVault] Error al guardar post:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
  }
}

/**
 * Maneja el clic en los botones de editar / eliminar (event delegation).
 * @param {MouseEvent} e
 */
async function handleGridClick(e) {
  const btn    = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const postId = Number(btn.dataset.id);

  if (action === 'edit') {
    const post = State.allPosts.find(p => p.id === postId);
    if (post) enterEditMode(post);
  }

  if (action === 'delete') {
    const confirmed = await openConfirmModal(postId);
    if (!confirmed) return;

    // Animación de salida
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (card) card.classList.add('removing');

    try {
      await ApiService.deletePost(postId);

      // Esperamos que termine la animación antes de quitar del DOM
      await wait(300);

      // Eliminamos del estado local
      State.allPosts = State.allPosts.filter(p => p.id !== postId);
      applyFilters();
      updateStatChip(State.filteredPosts.length);

      showToast(`Post #${postId} eliminado`, 'success');

      // Si estábamos editando ese post, salimos del modo edición
      if (State.editingId === postId) exitEditMode();

    } catch (err) {
      console.error('[PostVault] Error al eliminar post:', err);
      if (card) card.classList.remove('removing');
      showToast(`Error al eliminar: ${err.message}`, 'error');
    }
  }
}

/* ============================================================
   ██╗   ██╗████████╗██╗██╗     ███████╗
   ██║   ██║╚══██╔══╝██║██║     ██╔════╝
   ██║   ██║   ██║   ██║██║     ███████╗
   ██║   ██║   ██║   ██║██║     ╚════██║
   ╚██████╔╝   ██║   ██║███████╗███████║
    ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
   ============================================================ */

/**
 * Escapa HTML para evitar XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Capitaliza la primera letra de una cadena.
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Devuelve una promesa que se resuelve tras `ms` milisegundos.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Función debounce: retrasa la ejecución de fn hasta que
 * pasen `delay` ms sin nuevas llamadas.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ============================================================
   ██╗███╗   ██╗██╗████████╗
   ██║████╗  ██║██║╚══██╔══╝
   ██║██╔██╗ ██║██║   ██║   
   ██║██║╚██╗██║██║   ██║   
   ██║██║ ╚████║██║   ██║   
   ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   
   ============================================================ */

/**
 * Registra todos los event listeners de la aplicación.
 */
function registerListeners() {

  /* ── Formulario ── */
  document.getElementById('post-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('cancel-btn').addEventListener('click', exitEditMode);

  /* ── Contadores de caracteres en tiempo real ── */
  document.getElementById('post-title').addEventListener('input', () =>
    updateCharCount('post-title', 'title-count', 120));

  document.getElementById('post-body').addEventListener('input', () =>
    updateCharCount('post-body', 'body-count', 500));

  /* ── Limpiar error al corregir un campo ── */
  ['post-userId', 'post-title', 'post-body'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      e.target.classList.remove('has-error');
    });
  });

  /* ── Grid (event delegation para edit / delete) ── */
  document.getElementById('posts-grid').addEventListener('click', handleGridClick);

  /* ── Búsqueda con debounce (300ms) ── */
  const debouncedSearch = debounce((e) => {
    State.searchQuery = e.target.value;
    applyFilters();
  }, 300);
  document.getElementById('search-input').addEventListener('input', debouncedSearch);

  /* ── Filtro por usuario ── */
  document.getElementById('filter-user').addEventListener('change', (e) => {
    State.userFilter = e.target.value;
    applyFilters();
  });

  /* ── Botón Recargar ── */
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    State.searchQuery = '';
    State.userFilter  = '';
    document.getElementById('search-input').value = '';
    document.getElementById('filter-user').value  = '';
    exitEditMode();
    await loadPosts();
  });

  /* ── Botón Reintentar (pantalla de error) ── */
  document.getElementById('retry-btn').addEventListener('click', loadPosts);

  /* ── Cerrar modal haciendo clic fuera ── */
  document.getElementById('confirm-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.hidden = true;
    }
  });
}

/**
 * Punto de entrada principal.
 * Inicializa la aplicación cuando el DOM está listo.
 */
async function init() {
  registerListeners();
  await loadPosts();
}

// Arranque
document.addEventListener('DOMContentLoaded', init);
