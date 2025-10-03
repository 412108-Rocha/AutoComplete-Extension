# Extensión para agilizar la carga de formularios

## Descripción

- Extensión (Manifest V3) para definir campos con códigos, mapear inputs entre webs y copiar/pegar datos con atajos.
- Pensada para secretarías: reduce tiempos y errores en autorizaciones.

## Novedades clave

- UI con pestañas: Inicio (Portapapeles + Acciones), Campos, Mapeo, Atajos y Config, Tutoriales.
- Portapapeles y acciones unidos como pantalla principal.
- Campos: alta simple en filas, edición bloqueada hasta pulsar Editar por campo.
- Expiración fija de datos: 45 segundos (sin configuración de tiempo).
- Estilo moderno y minimalista (tema oscuro), tipografía del sistema, bordes suaves y estados claros.

---

## Conceptos

- **Campo**: nombre + tipo + código único. El código conecta origen/destino.
- **Mapeo por dominio**: código → selectorInput, con listas separadas para Origen (copiar) y Destino (pegar).
- **Expiración**: los datos copiados se eliminan automáticamente a los 45s.

---

## Estructura del proyecto

```
AutoComplete-Extension/
 ├── manifest.json       # Configuración de la extensión
 ├── popup.html          # Popup de la extensión (UI con tabs y estilo moderno)
 ├── popup.js            # Lógica de UI y storage
 ├── content.js          # Mapeo/copia/pegado en la web
 ├── datosPrueba.json    # Datos reales para rellenar el formulario (opcional para pruebas)
 └── background.js        # Script en segundo plano (service worker, atajos y notificaciones)
```

---

## Permisos (Manifest V3)

- `activeTab`, `scripting`, `storage`, `notifications`, `commands`.

---

## Tabs de la UI (popup)

1. **Inicio (principal)**
   - Acciones: Copiar y Pegar.
   - Portapapeles: estado, tiempo restante y lista `{código → valor}`.
   - Vaciar portapapeles.

2. **Campos**
   - Alta en filas: Tipo → Nombre → Código → Agregar.
   - Validaciones: no repetir nombre/código y compatibilidad por tipo (número: dígitos; fecha: YYYY-MM-DD; booleano: true/false/1/0/si/no).
   - Edición segura por fila: Editar → Guardar/Cancelar. Eliminar disponible por campo.

3. **Mapeo**
   - Mapear para copiar (origen) y Mapear para pegar (destino) por dominio.
   - Permite sobrescribir/añadir y borrar el mapeo del dominio actual.

4. **Atajos y Config**
   - Atajos por defecto: Ctrl+Shift+C (copiar), Ctrl+Shift+V (pegar). Se pueden activar/desactivar y abrir la página nativa de atajos.
   - Notificaciones nativas: activar/desactivar.
   - Importar/Exportar configuración en JSON.

5. **Tutoriales**
   - Conceptos clave, guía paso a paso y ejemplos de fechas (hoy, ayer, +3d, -2d, YYYY-MM-DD).

---

## Flujo de trabajo

1. **Definir campos**: creá tus campos con tipo y código único.
2. **Mapear origen**: en la web de origen, completá inputs con los códigos y usá “Mapear para copiar”.
3. **Mapear destino**: en la web destino, ubicá inputs y usá “Mapear para pegar”.
4. **Copiar**: toma valores de los inputs mapeados en origen.
5. **Pegar**: inserta solo en los inputs mapeados en destino. Soporta text/number/date/select/checkbox/radio.

---

## Reglas de pegado por tipo

- **Texto/Número**: `value`.
- **Fecha**: convierte hoy, ayer, +Nd, -Nd o YYYY-MM-DD a formato YYYY-MM-DD.
- **Select**: `option[value=...]`.
- **Checkbox/Radio**: marca según valor.

---

## Persistencia y backup

- `chrome.storage` para campos, mapeos, ajustes y portapapeles.
- Exportar/Importar JSON portable con validación básica.

---

## Atajos

- Ctrl+Shift+C: copiar.
- Ctrl+Shift+V: pegar.
- Se pueden activar/desactivar desde “Atajos y Config” y cambiar en `chrome://extensions/shortcuts`.

---

## Notificaciones

- Éxito, advertencias y errores con badge/notification.
- Muestran faltantes y tiempo restante antes de expirar.

---

## Instalación (modo desarrollador)

1. chrome://extensions
2. Activar Modo desarrollador.
3. Cargar descomprimida → seleccionar carpeta AutoComplete-Extension/.

---

## Prueba rápida

- Abrir `test-form.html` en el navegador.
- Definir campos, mapear origen/destino, Copiar y Pegar.
- Probar fechas relativas y radios/selects.

---

## Cobertura de requisitos

- Definir campos con tipo y código único: listo.
- Mapear inputs origen/destino, sobrescribir/añadir y borrar por dominio: listo.
- Copiar/pegar solo inputs mapeados: listo.
- Persistencia y exportación: listo.
- Expiración automática a 45s: listo.
- Notificaciones claras: listo.
- Shortcuts configurables: listo.
- Tutoriales ampliados en su pestaña: listo.
- UI con tabs; pantalla principal = Portapapeles + Acciones; Campos en filas: listo.

---

## Notas

- Si cambia el DOM del sitio, remapeá el dominio.
- Mantené códigos únicos y estables.
