// background.js - MV3 service worker

const DEFAULT_SETTINGS = {
  ttlSeconds: 900,
  notifications: true,
  commandsEnabled: true
};

chrome.runtime.onInstalled.addListener(async () => {
  // Inicializar settings si no existen
  const { settings } = await chrome.storage.sync.get(["settings"]);
  if (!settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
  // Inicializar estructura base
  const init = await chrome.storage.sync.get(["fields", "mappings"]);
  if (!init.fields) {
    await chrome.storage.sync.set({
      fields: {
        texto: { nombre: "nom", apellido: "ape" },
        numeros: { dni: "1", nroAfiliado: "2" },
        fechas: { fechaNacimiento: "2025-09-01", fechaConsulta: "2025-09-02" },
        booleanos: { terminos: "true" },
        select: { sexo: "M", obraSocial: "OSDE", prioridad: "alta", tipoAutorizacion: "Consulta" },
        textoLargo: { observaciones: "obsPrueba", email: "email@prueba.com", telefono: "3" }
      }
    });
  }
  if (!init.mappings) {
    await chrome.storage.sync.set({ mappings: {} });
  }
});

// Comandos de teclado
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "copiar" && command !== "pegar") return;
  const { settings } = await chrome.storage.sync.get(["settings"]);
  if (settings && settings.commandsEnabled === false) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: command });
  }
});

function badgeByContext(context) {
  switch (context) {
    case "success": return { text: "OK", color: "#2E7D32" };
    case "warn": return { text: "!", color: "#F9A825" };
    case "error": return { text: "X", color: "#C62828" };
    default: return { text: "i", color: "#1976D2" };
  }
}

// Notificaciones centralizadas
async function notify({ title, message, context = "info" }) {
  const { settings } = await chrome.storage.sync.get(["settings"]);
  if (settings && settings.notifications === false) return;
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png", // opcional si existe
      title,
      message,
      priority: 0
    });
  } catch (e) {
    // Fallback: badge temporal
    const { text, color } = badgeByContext(context);
    try {
      await chrome.action.setBadgeBackgroundColor({ color });
      await chrome.action.setBadgeText({ text });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    } catch (_) {
      // noop
    }
    console.debug("notify fallback:", title, message);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "notify") {
    notify(msg.payload);
  }
  else if (msg?.type === "exportConfig") {
    (async () => {
      const all = await chrome.storage.sync.get(null);
      const exportData = { ...all };
      if (exportData.fields) {
        const f = exportData.fields;
        exportData.config_export = {
          campos: {
            texto: f.texto || {},
            numeros: f.numeros || {},
            fechas: f.fechas || {}
          },
          extras: {
            booleanos: f.booleanos || {},
            select: f.select || {},
            textoLargo: f.textoLargo || {}
          },
          settings: exportData.settings || DEFAULT_SETTINGS,
          mappings: exportData.mappings || {}
        };
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: "autocomplete-config.json", saveAs: true });
      sendResponse({ ok: true });
    })();
    return true;
  }
  else if (msg?.type === "importConfig") {
    (async () => {
      try {
        const { json } = msg.payload || {};
        if (!json || typeof json !== "object") throw new Error("JSON inválido");
        const next = {};
        if (json.fields || json.config_export?.campos) {
          const campos = json.fields || json.config_export.campos;
          next.fields = {
            texto: campos.texto || {},
            numeros: campos.numeros || campos["números"] || {},
            fechas: campos.fechas || {},
            booleanos: json.fields?.booleanos || json.config_export?.extras?.booleanos || {},
            select: json.fields?.select || json.config_export?.extras?.select || {},
            textoLargo: json.fields?.textoLargo || json.config_export?.extras?.textoLargo || {}
          };
        }
        if (json.mappings || json.config_export?.mappings) {
          next.mappings = json.mappings || json.config_export.mappings;
        }
        if (json.settings || json.config_export?.settings) {
          next.settings = json.settings || json.config_export.settings;
        }
        await chrome.storage.sync.set(next);
        notify({ title: "Importación", message: "Configuración importada correctamente", context: "success" });
        sendResponse({ ok: true });
      } catch (e) {
        notify({ title: "Importación", message: "Error al importar: " + e.message, context: "error" });
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
  else if (msg?.type === "openShortcutsPage") {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
});
