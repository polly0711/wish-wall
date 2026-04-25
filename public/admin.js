/* ─────────────────────────────────────────────────────────────── */
/*  admin.js — 管理後台程式                                        */
/* ─────────────────────────────────────────────────────────────── */

// Elements
const loginCard     = document.getElementById('login-card');
const loginForm     = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginError    = document.getElementById('login-error');
const dashboard     = document.getElementById('dashboard');
const wishTbody     = document.getElementById('wish-tbody');
const wishCount     = document.getElementById('wish-count');
const emptyState    = document.getElementById('empty-state');
const logoutBtn     = document.getElementById('logout-btn');

// Edit modal
const modalOverlay  = document.getElementById('modal-overlay');
const editForm      = document.getElementById('edit-form');
const editId        = document.getElementById('edit-id');
const editName      = document.getElementById('edit-name');
const editContent   = document.getElementById('edit-content');
const editCharCount = document.getElementById('edit-char-count');
const editError     = document.getElementById('edit-error');
const cancelBtn     = document.getElementById('cancel-btn');

// Delete modal
const deleteOverlay   = document.getElementById('delete-overlay');
const deleteId        = document.getElementById('delete-id');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn= document.getElementById('delete-confirm-btn');

let adminPassword = '';

// ── Login ────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = passwordInput.value.trim();
  if (!pw) {
    loginError.textContent = '請輸入密碼';
    return;
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || '密碼不正確';
      return;
    }

    adminPassword = pw;
    loginCard.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadWishes();
  } catch (err) {
    loginError.textContent = '網路錯誤，請稍後再試';
  }
});

// ── Logout ───────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => {
  adminPassword = '';
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
  passwordInput.value = '';
  loginError.textContent = '';
});

// ── Load Wishes ──────────────────────────────────────────────────
async function loadWishes() {
  try {
    const res = await fetch('/api/wishes');
    const wishes = await res.json();
    renderTable(wishes);
  } catch (err) {
    console.error('載入心願失敗:', err);
  }
}

function renderTable(wishes) {
  wishTbody.innerHTML = '';
  wishCount.textContent = wishes.length;

  if (wishes.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  wishes.forEach((wish, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.id = wish._id;
    tr.innerHTML = `
      <td class="td-num">${idx + 1}</td>
      <td class="td-name">${escapeHtml(wish.name)}</td>
      <td class="td-content">${escapeHtml(wish.content)}</td>
      <td class="td-time">${formatTime(wish.created_at)}</td>
      <td class="td-actions">
        <button class="action-btn edit-btn" data-id="${wish._id}" data-name="${escapeAttr(wish.name)}" data-content="${escapeAttr(wish.content)}">✏️ 編輯</button>
        <button class="action-btn del-btn" data-id="${wish._id}">🗑️ 刪除</button>
      </td>
    `;
    wishTbody.appendChild(tr);
  });

  // Attach edit/delete listeners
  wishTbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id, btn.dataset.name, btn.dataset.content));
  });
  wishTbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

// ── Helpers ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Edit Modal ───────────────────────────────────────────────────
function openEditModal(id, name, content) {
  editId.value = id;
  editName.value = name;
  editContent.value = content;
  editCharCount.textContent = `${content.length} / 200`;
  editError.textContent = '';
  modalOverlay.classList.remove('hidden');
}

cancelBtn.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
});

editContent.addEventListener('input', () => {
  editCharCount.textContent = `${editContent.value.length} / 200`;
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id      = editId.value;
  const name    = editName.value.trim();
  const content = editContent.value.trim();

  if (!name || !content) {
    editError.textContent = '姓名和心願都不能為空';
    return;
  }

  try {
    const res = await fetch(`/api/wishes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify({ name, content })
    });
    const data = await res.json();

    if (!res.ok) {
      editError.textContent = data.error || '儲存失敗';
      return;
    }

    modalOverlay.classList.add('hidden');
    loadWishes(); // Refresh table
  } catch (err) {
    editError.textContent = '網路錯誤，請稍後再試';
  }
});

// ── Delete Modal ─────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteId.value = id;
  deleteOverlay.classList.remove('hidden');
}

deleteCancelBtn.addEventListener('click', () => {
  deleteOverlay.classList.add('hidden');
});

deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) deleteOverlay.classList.add('hidden');
});

deleteConfirmBtn.addEventListener('click', async () => {
  const id = deleteId.value;

  try {
    const res = await fetch(`/api/wishes/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || '刪除失敗');
      return;
    }

    deleteOverlay.classList.add('hidden');
    loadWishes(); // Refresh table
  } catch (err) {
    alert('網路錯誤，請稍後再試');
  }
});
