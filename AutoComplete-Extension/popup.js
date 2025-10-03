// popup.js - UI principal

// Utilidades
function q(id) { return document.getElementById(id); }
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

async function getAll() { return await chrome.storage.sync.get(["fields", "settings", "mappings", "clipboard"]); }
async function setAll(obj) { return await chrome.storage.sync.set(obj); }

function validarCodigoPorTipo(cat, codigo) {
  const v = (codigo ?? '').toString().trim();
  if (!v) return { ok: false, msg: 'Código requerido' };
  switch (cat) {
    case 'numeros':
      return /^\d+$/.test(v) ? { ok: true } : { ok: false, msg: 'Solo dígitos' };
    case 'fechas':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? { ok: true } : { ok: false, msg: 'Formato YYYY-MM-DD' };
    case 'booleanos': {
      const s = v.toLowerCase();
      const ok = ['true','false','1','0','si','sí','no'].includes(s);
      return ok ? { ok: true } : { ok: false, msg: 'true/false/1/0/si/no' };
    }
    default:
      return { ok: true };
  }
}

function hintPorTipo(cat) {
  switch (cat) {
    case 'numeros': return 'Solo dígitos (ej: 1234).';
    case 'fechas': return 'Formato YYYY-MM-DD (ej: 2025-09-01).';
    case 'booleanos': return 'Usá true/false/1/0/si/no.';
    default: return 'Texto libre. Usalo como identificador único.';
  }
}

async function cargarCampos() {
  const { fields } = await chrome.storage.sync.get(["fields"]);
  const cont = q('listaCampos');
  cont.innerHTML = '';
  const cats = [
    ['texto','Texto'], ['numeros','Números'], ['fechas','Fechas'], ['booleanos','Booleanos'], ['select','Select'], ['textoLargo','Texto largo']
  ];
  const all = fields || {};
  cats.forEach(([key, label]) => {
    const grupo = all[key] || {};
    cont.appendChild(el('div', { className: 'cat' }, label));
    const ul = el('ul');

    const renderRow = (nombre, codigo) => {
      const li = el('li');
      const viewSpan = el('span', { className: 'grow' }, `${nombre} → ${codigo}`);
      const btnEdit = el('button', { innerText: 'Editar' });
      const btnDel = el('button', { innerText: 'Eliminar' });

      btnEdit.addEventListener('click', () => {
        // Modo edición
        li.innerHTML = '';
        const codeInput = el('input', { value: codigo, size: 14 });
        const btnSave = el('button', { innerText: 'Guardar' });
        const btnCancel = el('button', { innerText: 'Cancelar' });
        const msg = el('small', { className: 'muted' });
        btnSave.addEventListener('click', async () => {
          const v = codeInput.value.trim();
          const chk = validarCodigoPorTipo(key, v);
          if (!chk.ok) { msg.textContent = chk.msg; return; }
          const snap = await chrome.storage.sync.get(["fields"]);
          const f = snap.fields || {};
          // Validar duplicados globales (excepto el propio)
          const dup = Object.keys(f).some(cat => Object.keys(f[cat]||{}).some(n => (cat!==key || n!==nombre) && (f[cat][n] === v)));
          if (dup) { msg.textContent = 'Código duplicado'; return; }
          f[key] = { ...(f[key]||{}) };
          f[key][nombre] = v;
          await chrome.storage.sync.set({ fields: f });
          // Re-render
          li.replaceWith(renderRow(nombre, v));
        });
        btnCancel.addEventListener('click', () => {
          li.replaceWith(renderRow(nombre, codigo));
        });
        li.appendChild(el('span', { className: 'grow' }, `${nombre} → `));
        li.appendChild(codeInput);
        li.appendChild(btnSave);
        li.appendChild(btnCancel);
        li.appendChild(el('span', { style: 'margin-left:6px;' }, msg));
      });

      btnDel.addEventListener('click', async () => {
        const snap = await chrome.storage.sync.get(["fields"]);
        const f = snap.fields || {};
        if (f[key]) { delete f[key][nombre]; }
        await chrome.storage.sync.set({ fields: f });
        li.remove();
      });

      li.appendChild(viewSpan);
      li.appendChild(btnEdit);
      li.appendChild(btnDel);
      return li;
    };

    Object.keys(grupo).sort().forEach(nombre => {
      const codigo = grupo[nombre];
      ul.appendChild(renderRow(nombre, codigo));
    });

    cont.appendChild(ul);
  });
}

async function agregarCampo() {
  const cat = q('campoCategoria').value;
  const nombre = q('campoNombre').value.trim();
  const codigo = q('campoCodigo').value.trim();
  if (!nombre) { alert('Nombre requerido'); return; }
  const chk = validarCodigoPorTipo(cat, codigo);
  if (!chk.ok) { alert('Código inválido: ' + chk.msg); return; }
  const snap = await chrome.storage.sync.get(["fields"]);
  const f = snap.fields || {};
  // Validar duplicado de nombre dentro de la categoría y de código global
  const dupNombre = (f[cat] && Object.prototype.hasOwnProperty.call(f[cat], nombre));
  const dupCodigo = Object.keys(f).some(k => Object.values(f[k]||{}).includes(codigo));
  if (dupNombre) { alert('El nombre ya existe en la categoría'); return; }
  if (dupCodigo) { alert('El código ya existe'); return; }
  f[cat] = { ...(f[cat]||{}) };
  f[cat][nombre] = codigo;
  await chrome.storage.sync.set({ fields: f });
  q('campoNombre').value = '';
  q('campoCodigo').value = '';
  await cargarCampos();
}

function sendToActiveTab(action, payload) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) {
      chrome.runtime.sendMessage({ type: 'notify', payload: { title: 'Conexión', message: 'No hay pestaña activa', context: 'warn' } });
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action, ...(payload||{}) }, () => {
      if (chrome.runtime.lastError) {
        // Silenciar error típico cuando no hay content script (chrome://, about:blank, etc.)
        chrome.runtime.sendMessage({ type: 'notify', payload: { title: 'Conexión', message: 'No se pudo comunicar con la pestaña. Abrí una página web y volvé a intentar.', context: 'warn' } });
      }
    });
  });
}

// Mapeo
function mapearCopiar() { sendToActiveTab('mapear_copiar'); }
function mapearPegar() { sendToActiveTab('mapear_pegar'); }
function borrarMapeoDominio() { sendToActiveTab('borrar_mapeo_dominio'); }

// Acciones copiar/pegar
function accionCopiar() { sendToActiveTab('copiar'); }
function accionPegar() { sendToActiveTab('pegar'); }

// Estado portapapeles
let clipTimer = null;
function pintarClipEstado(data, remaining) {
  const lbl = q('estadoClip');
  const txt = q('tiempoClip');
  const list = q('listaClip');
  list.innerHTML = '';
  if (!data || Object.keys(data).length === 0) {
    lbl.className = 'pill err';
    lbl.textContent = 'Vacío';
    txt.textContent = '';
    return;
  }
  lbl.className = 'pill ok';
  lbl.textContent = 'Listo';
  txt.textContent = remaining ? ` expira en ${remaining}s` : '';
  Object.keys(data).forEach(k => {
    const v = data[k];
    list.appendChild(el('li', {}, `${k}: ${v}`));
  });
}

function refrescarPortapapeles() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) { pintarClipEstado({}, 0); return; }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'estado_portapapeles' }, (res) => {
      if (chrome.runtime.lastError) { pintarClipEstado({}, 0); return; }
      if (!res || !res.ok) { pintarClipEstado({}, 0); return; }
      pintarClipEstado(res.data, res.remaining);
      if (clipTimer) clearTimeout(clipTimer);
      if (res.remaining > 0) {
        clipTimer = setTimeout(refrescarPortapapeles, 1000);
      }
    });
  });
}

function vaciarClip() { sendToActiveTab('vaciar_portapapeles'); setTimeout(refrescarPortapapeles, 200); }

// Configuración
async function cargarConfig() {
  const { settings } = await chrome.storage.sync.get(["settings"]);
  const s = settings || { ttlSeconds: 45, notifications: true, commandsEnabled: true };
  // TTL ya no es configurable por UI; queda en 45s por defecto
  q('notifsChk').checked = !!s.notifications;
  const chk = q('cmdsChk');
  if (chk) chk.checked = !!s.commandsEnabled;
}

async function guardarConfig() {
  // Guardar solo notificaciones; ttlSeconds no se configura por UI
  const notifications = q('notifsChk').checked;
  const current = (await chrome.storage.sync.get(["settings"]))?.settings || {};
  const next = { ...current, notifications };
  await chrome.storage.sync.set({ settings: next });
  chrome.runtime.sendMessage({ type: 'notify', payload: { title: 'Configuración', message: 'Guardada', context: 'success' } });
}

async function toggleShortcutsEnabled(e) {
  const enabled = e.target.checked;
  const { settings } = await chrome.storage.sync.get(["settings"]);
  const next = { ...(settings||{}), commandsEnabled: enabled };
  await chrome.storage.sync.set({ settings: next });
  chrome.runtime.sendMessage({ type: 'notify', payload: { title: 'Atajos', message: enabled ? 'Activados' : 'Desactivados', context: 'success' } });
}

function exportarJSON() { chrome.runtime.sendMessage({ type: 'exportConfig' }); }

function importarJSON() {
  q('importFile').click();
}

function onImportFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      chrome.runtime.sendMessage({ type: 'importConfig', payload: { json } }, (res) => {
        // refrescar UI luego de importar
        cargarCampos();
        cargarConfig();
        refrescarPortapapeles();
      });
    } catch (err) {
      alert('JSON inválido');
    }
  };
  reader.readAsText(file);
}

function abrirAtajos() { chrome.runtime.sendMessage({ type: 'openShortcutsPage' }); }

// Tabs
function setActiveTab(id) {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panes = Array.from(document.querySelectorAll('.tab-content'));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
  panes.forEach(p => p.classList.toggle('active', p.dataset.tab === id));
  chrome.storage.local.set({ activeTab: id });
}

async function initTabs() {
  const { activeTab } = await chrome.storage.local.get(['activeTab']);
  const initial = activeTab || 'inicio';
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.target));
  });
  setActiveTab(initial);
}

function wireHintCodigo() {
  const sel = q('campoCategoria');
  const hint = q('hintCodigo');
  if (!sel || !hint) return;
  const update = () => { hint.textContent = `${hintPorTipo(sel.value)} Para Fechas relativas al pegar, se admiten hoy, ayer, +3d.`; };
  sel.addEventListener('change', update);
  update();
}

// Wire-up
window.addEventListener('DOMContentLoaded', () => {
  // Tabs primero
  initTabs();

  // Campos
  q('agregarCampo').addEventListener('click', agregarCampo);
  cargarCampos();
  wireHintCodigo();

  // Mapeo
  q('mapearCopiar').addEventListener('click', mapearCopiar);
  q('mapearPegar').addEventListener('click', mapearPegar);
  q('borrarMapeoDominio').addEventListener('click', borrarMapeoDominio);

  // Acciones
  q('btnCopiar').addEventListener('click', accionCopiar);
  q('btnPegar').addEventListener('click', accionPegar);

  // Portapapeles
  q('vaciarClip').addEventListener('click', vaciarClip);
  refrescarPortapapeles();

  // Config
  cargarConfig();
  q('guardarConfig').addEventListener('click', guardarConfig);
  q('exportar').addEventListener('click', exportarJSON);
  q('importar').addEventListener('click', importarJSON);
  q('importFile').addEventListener('change', onImportFileChange);

  // Atajos
  q('abrirAtajos').addEventListener('click', abrirAtajos);
  q('cmdsChk').addEventListener('change', toggleShortcutsEnabled);
});
