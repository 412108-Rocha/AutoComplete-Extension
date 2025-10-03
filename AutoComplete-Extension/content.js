// AutoComplete-Extension/content.js

// Helpers base
function getDomain() { return window.location.hostname; }

function parseBooleanLike(val) {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
        const v = val.trim().toLowerCase();
        if (v === "true" || v === "1" || v === "si" || v === "sí") return true;
        if (v === "false" || v === "0" || v === "no") return false;
    }
    return !!val;
}

function normalizarValorInput(input) {
    const tag = input.tagName.toLowerCase();
    const type = (input.type || tag || "").toLowerCase();
    if (type === "checkbox") return !!input.checked;
    if (type === "radio") return input.checked ? input.value : null;
    if (tag === "select") return input.value;
    return (input.value || "").trim();
}

function obtenerSelectorUnico(el) {
    if (!el || !el.nodeType) return null;
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]`;
    let path = [];
    let elem = el;
    while (elem && elem.nodeType === 1 && elem.tagName.toLowerCase() !== "html") {
        let selector = elem.tagName.toLowerCase();
        if (elem.id) {
            selector += `#${elem.id}`;
            path.unshift(selector);
            break;
        } else {
            let siblings = Array.from(elem.parentNode.children).filter(e => e.tagName === elem.tagName);
            if (siblings.length > 1) {
                selector += `:nth-of-type(${Array.from(elem.parentNode.children).indexOf(elem) + 1})`;
            }
        }
        path.unshift(selector);
        elem = elem.parentNode;
    }
    return path.join(" > ");
}

const DEFAULT_TTL_SECONDS = 45;

async function getSettings() {
    const { settings } = await chrome.storage.sync.get(["settings"]);
    // Forzamos TTL por defecto en 45 si no existe o es inválido
    const s = settings || { ttlSeconds: DEFAULT_TTL_SECONDS, notifications: true, commandsEnabled: true };
    if (!Number.isFinite(s.ttlSeconds) || s.ttlSeconds <= 0) s.ttlSeconds = DEFAULT_TTL_SECONDS;
    return s;
}

function notify(payload) {
    chrome.runtime.sendMessage({ type: "notify", payload });
}

async function getFieldsPlanos() {
    const { fields } = await chrome.storage.sync.get(["fields"]);
    const all = fields || {};
    // Aplanar a mapa { campo: codigo }
    const planos = {};
    Object.keys(all).forEach(cat => {
        const grp = all[cat] || {};
        Object.keys(grp).forEach(campo => { planos[campo] = grp[campo]; });
    });
    return planos;
}

async function loadMappings() {
    const { mappings } = await chrome.storage.sync.get(["mappings"]);
    return mappings || {};
}

async function saveMappings(next) {
    await chrome.storage.sync.set({ mappings: next });
}

function nowMs() { return Date.now(); }

async function getClipboard() {
    const { clipboard } = await chrome.storage.sync.get(["clipboard"]);
    return clipboard || null;
}

async function setClipboard(obj) {
    await chrome.storage.sync.set({ clipboard: obj });
}

async function clearClipboard() {
    await chrome.storage.sync.remove(["clipboard"]);
}

function isExpired(clip) {
    if (!clip) return true;
    const { ts, ttlSeconds } = clip;
    return !ts || (nowMs() - ts) > (ttlSeconds * 1000);
}

function timeRemaining(clip) {
    if (!clip) return 0;
    const rem = (clip.ttlSeconds * 1000) - (nowMs() - clip.ts);
    return Math.max(0, Math.floor(rem / 1000));
}

// Parseo flexible de fechas: "hoy", "ayer", "+3d", "-2d", "YYYY-MM-DD"
function parseFechaFlexible(valor) {
    if (!valor) return "";
    const v = ("" + valor).trim().toLowerCase();
    const d = new Date();
    const fmt = (date) => date.toISOString().slice(0, 10);
    if (v === "hoy" || v === "today") return fmt(d);
    if (v === "ayer" || v === "yesterday") {
        const t = new Date(d); t.setDate(t.getDate() - 1); return fmt(t);
    }
    const m = v.match(/^([+-])(\d+)d$/);
    if (m) { const sign = m[1] === "+" ? 1 : -1; const days = parseInt(m[2], 10) || 0; const t = new Date(d); t.setDate(t.getDate() + sign * days); return fmt(t); }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Fallback a Date parse
    const parsed = new Date(valor);
    if (!isNaN(parsed)) return fmt(parsed);
    return "";
}

function dispatchInputChange(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Mapeo genérico
async function mapearCampos(mode /* 'copy' | 'paste' */) {
    const inputs = document.querySelectorAll("input, select, textarea");
    const domain = getDomain();
    const planos = await getFieldsPlanos();

    // Construir mapa {codigo -> campo}
    const codigoPorCampo = {};
    Object.keys(planos).forEach(campo => {
        codigoPorCampo[campo] = planos[campo];
    });

    const nuevo = {};
    inputs.forEach((input) => {
        const valor = normalizarValorInput(input);
        // Revisar contra todos los codigos
        for (let campo in codigoPorCampo) {
            const codigo = codigoPorCampo[campo];
            // Comparar booleano o string/numero
            const esperadoBool = ("" + codigo).trim().toLowerCase();
            const isBoolCode = esperadoBool === "true" || esperadoBool === "false";
            const match = isBoolCode ? (parseBooleanLike(valor) === parseBooleanLike(codigo)) : (valor == codigo);
            if (match) {
                nuevo[codigo] = {
                    selector: obtenerSelectorUnico(input),
                    type: (input.type || input.tagName || "").toLowerCase(),
                    name: input.name || null
                };
            }
        }
    });

    const mappings = await loadMappings();
    const actual = mappings[domain] || { copy: {}, paste: {} };
    const merged = { ...actual[mode], ...nuevo };
    mappings[domain] = { ...actual, [mode]: merged };
    await saveMappings(mappings);

    notify({ title: "Mapeo", message: `Mapeo de ${mode === 'copy' ? 'copiar' : 'pegar'} guardado (${Object.keys(nuevo).length} campos) para ${domain}`, context: "success" });
}

async function limpiarMapeo() {
    const domain = getDomain();
    const mappings = await loadMappings();
    delete mappings[domain];
    await saveMappings(mappings);
    notify({ title: "Mapeo", message: `Mapeo eliminado para ${domain}`, context: "warn" });
}

// Copiar desde origen
async function copiarDatos() {
    const domain = getDomain();
    const mappings = await loadMappings();
    const map = mappings[domain]?.copy || {};
    const codigos = Object.keys(map);
    if (codigos.length === 0) {
        notify({ title: "Copiar", message: "No hay mapeo de origen para este dominio", context: "error" });
        return;
    }
    const datos = {};
    const faltantes = [];
    codigos.forEach(codigo => {
        const { selector, type } = map[codigo];
        const input = document.querySelector(selector);
        if (!input) { faltantes.push(codigo); return; }
        let val = normalizarValorInput(input);
        if (type === "radio" && !val) {
            // Si no estaba chequeado el radio concreto, leer el grupo
            const name = map[codigo].name;
            if (name) {
                const checked = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
                val = checked ? checked.value : null;
            }
        }
        datos[codigo] = val;
    });

    // TTL fijo en 45s
    const clip = { data: datos, ts: nowMs(), ttlSeconds: DEFAULT_TTL_SECONDS };
    await setClipboard(clip);

    const okCount = codigos.length - faltantes.length;
    const msg = `Copiados ${okCount}/${codigos.length}` + (faltantes.length ? `, faltan: ${faltantes.join(", ")}` : "");
    notify({ title: "Copiar", message: msg, context: faltantes.length ? "warn" : "success" });
}

// Pegar en destino
async function pegarDatos() {
    const clip = await getClipboard();
    if (!clip || isExpired(clip)) {
        await clearClipboard();
        notify({ title: "Pegar", message: "No hay datos vigentes para pegar", context: "error" });
        return;
    }
    const domain = getDomain();
    const mappings = await loadMappings();
    const map = mappings[domain]?.paste || {};
    const codigos = Object.keys(map);
    if (codigos.length === 0) {
        notify({ title: "Pegar", message: "No hay mapeo de destino para este dominio", context: "error" });
        return;
    }

    const faltantes = [];
    let pegados = 0;

    for (const codigo of codigos) {
        const { selector, type } = map[codigo];
        const input = document.querySelector(selector);
        const valor = clip.data[codigo];
        if (!input) { faltantes.push(codigo); continue; }
        if (valor == null || valor === "") { faltantes.push(codigo); continue; }

        const tag = input.tagName.toLowerCase();
        const t = (type || tag).toLowerCase();
        try {
            if (t === "checkbox") {
                input.checked = parseBooleanLike(valor);
                dispatchInputChange(input);
            } else if (t === "radio") {
                const name = map[codigo].name || input.name;
                if (name) {
                    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
                    radios.forEach(r => {
                        r.checked = (r.value == valor);
                        if (r.checked) dispatchInputChange(r);
                    });
                } else {
                    input.checked = (input.value == valor);
                    if (input.checked) dispatchInputChange(input);
                }
            } else if (tag === "select") {
                input.value = valor;
                dispatchInputChange(input);
            } else if (t === "date") {
                const v = parseFechaFlexible(valor);
                if (v) input.value = v; else input.value = "";
                dispatchInputChange(input);
            } else if (t === "number") {
                input.value = valor != null ? String(valor) : "";
                dispatchInputChange(input);
            } else {
                input.value = valor;
                dispatchInputChange(input);
            }
            pegados++;
        } catch (e) {
            console.warn("Error pegando", codigo, e);
            faltantes.push(codigo);
        }
    }

    const rem = timeRemaining(clip);
    const msg = `Pegados ${pegados}/${codigos.length}` + (faltantes.length ? `, faltan: ${faltantes.join(", ")}` : "") + (rem ? ` — expira en ${rem}s` : "");
    notify({ title: "Pegar", message: msg, context: faltantes.length ? "warn" : "success" });
}

// Compatibilidad con acciones antiguas del popup anterior
async function legacyMapear() { await mapearCampos("copy"); await mapearCampos("paste"); }
async function legacyRellenar() { await pegarDatos(); }

// Mensajería
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        switch (msg.action) {
            case "mapear": // legado
                await legacyMapear(); break;
            case "rellenar": // legado
                await legacyRellenar(); break;
            case "limpiar": // legado
                await limpiarMapeo(); break;

            case "mapear_copiar":
                await mapearCampos("copy"); break;
            case "mapear_pegar":
                await mapearCampos("paste"); break;
            case "copiar":
                await copiarDatos(); break;
            case "pegar":
                await pegarDatos(); break;
            case "estado_portapapeles": {
                const clip = await getClipboard();
                const expired = isExpired(clip);
                if (expired && clip) await clearClipboard();
                sendResponse({
                    ok: true,
                    data: expired ? {} : (clip?.data || {}),
                    remaining: expired ? 0 : timeRemaining(clip)
                });
                return; // keep channel open only when needed
            }
            case "vaciar_portapapeles":
                await clearClipboard();
                notify({ title: "Portapapeles", message: "Datos vaciados", context: "warn" });
                break;
            case "borrar_mapeo_dominio":
                await limpiarMapeo();
                break;
            default:
                break;
        }
        sendResponse({ ok: true });
    })();
    return true; // async
});
