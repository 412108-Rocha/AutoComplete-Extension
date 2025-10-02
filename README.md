# Extensión para agilizar la carga de formularios

## Descripción

- Extensión de navegador (Manifest V3) para definir campos con códigos, mapear inputs entre webs y copiar/pegar datos de forma segura y rápida.
- Pensada para secretarías: reduce tiempos y errores en autorizaciones.

---

## Conceptos clave

- **Campo**: nombre + tipo + código único. El código es el puente entre páginas.
- **Mapeo por dominio**: relación código → selectorInput, separada para Origen (copiar) y Destino (pegar).
- **Portapapeles interno**: `{ código → valor, timestamp }` con TTL configurable (tiempo de expiración).

---

## Estructura del proyecto

```
AutoComplete-Extension/
 ├── manifest.json       # Configuración de la extensión
 ├── popup.html          # Popup de la extensión (botones Mapear, Rellenar, Limpiar)
 ├── popup.js            # Script del popup
 ├── content.js          # Script que interactúa con la página
 ├── datosPrueba.json    # Datos reales para rellenar el formulario
 └── background.js        # Script en segundo plano
```

---

## Permisos (Manifest V3)

- `activeTab`, `scripting`, `storage`, `notifications`, `commands`.

---

## Tabs de la UI (popup)

1. **Principal: Portapapeles y Acciones**
   - Ver lista de datos copiados (código → valor). Muestra hace cuánto y tiempo restante (TTL).
   - Acciones: Mapear Origen, Mapear Destino, Copiar, Pegar, Vaciar portapapeles.
   - Notificaciones: éxito, advertencias por campos faltantes y tiempo restante.
   - Criterio: copia/pega solo de inputs mapeados para el dominio actual.

2. **Campos (gestión especializada)**
   - Vista bloqueada por defecto (solo lectura).
   - Botón Editar para habilitar cambios.
   - Alta en filas: cada fila = Campo | Tipo | Código | Acciones (Guardar/Cancelar).
   - Validaciones:
     - Campo y código no repetidos.
     - Código compatible con tipo (ej.: fecha → YYYY-MM-DD; número → solo dígitos).
   - CRUD:
     - Crear: agrega una nueva fila editable.
     - Editar: habilita filas existentes; Guardar aplica cambios; Cancelar revierte.
     - Eliminar: quita el campo seleccionado.
   - Estructura sugerida de almacenamiento:
     ```json
     {
       "texto": { "nombre": "nom", "apellido": "ape" },
       "números": { "dni": "1", "nroAfiliado": "2" },
       "fechas": { "fechaNacimiento": "2025-09-01" }
     }
     ```
   - Estilo: filas separadas con espaciado, labels claros y estados (focus/hover/error).

3. **Atajos y Configuración**
   - Atajos por defecto: Ctrl+Shift+C (Copiar), Ctrl+Shift+V (Pegar).
   - Cambiar o desactivar atajos.
   - Configurar TTL del portapapeles (segundos/minutos) y opciones de notificaciones.
   - Borrar mapeo por dominio bajo demanda.
   - Importar/Exportar configuración en JSON.

4. **Tutoriales**
   - Sin botón de info en otras pantallas; todos los pasos viven aquí.
   - Onboarding sugerido (paso a paso):
     1. Definir campos: crear los campos clave con sus tipos y códigos.
     2. Mapear Origen: en la página de origen, asociar código ↔ input.
     3. Mapear Destino: en la página destino, asociar código ↔ input.
     4. Copiar: usar botón o atajo para capturar valores del origen.
     5. Pegar: usar botón o atajo para completar el destino.
   - Guías específicas:
     - Campos: ejemplos de códigos válidos por tipo, errores comunes y cómo revertir cambios.
     - Mapeo: cómo resolver conflictos (sobrescritura) y borrar mapeos por dominio.
     - Copiar/Pegar: qué ocurre si faltan campos, cómo se calcula el TTL, estados de notificación.
     - Exportar/Importar: qué se incluye y validaciones al importar.

---

## Flujos principales

- **Mapear para copiar (Origen)**: guarda por dominio `{ código → selector }` y permite sobrescribir o añadir.
- **Mapear para pegar (Destino)**: guarda estructura similar por dominio destino.
- **Copiar**: busca inputs en el DOM según mapeo de Origen y guarda `{ código → valor, timestamp }`.
- **Pegar**: busca inputs según mapeo de Destino e inserta valores por tipo:
  - Texto/Número: `value`
  - Fechas: entiende hoy, ayer, +3d y convierte a YYYY-MM-DD
  - Select: `option[value=...]`
  - Checkbox/Radio: coincide por valor y marca
- **Expiración**: el portapapeles se borra automáticamente al vencer el TTL o al copiar de nuevo desde origen.

---

## Almacenamiento y persistencia

- `chrome.storage` para configuraciones, campos y mapeos.
- Portapapeles en memoria con respaldo temporal opcional.
- Exportar/Importar en JSON (compatible y portable). Se valida compatibilidad al importar.

---

## Notificaciones y estados

- Verde (éxito), Amarillo (advertencia), Rojo (error).
- Copiar/Pegar informan campos completos/faltantes y tiempo restante del TTL.

---

## Compatibilidad y tipos soportados

- Inputs: `text`, `number`, `date`, `select`, `radio`, `checkbox`, `textarea`.
- Navegador: Chrome/Chromium con Manifest V3.

---

## Prueba rápida con test-form.html

- Abrir `test-form.html` en el navegador.
- Usar la extensión para mapear origen/destino, copiar y pegar.
- Probar casos: selects, radios, fechas relativas (hoy, ayer, +Nd).

---

## Glosario

- **TTL**: tiempo de expiración de los datos del portapapeles. Al llegar a 0, se eliminan.

---

## Estructuras de datos (resumen)

- **Campos**: agrupados por tipo con validaciones.
- **Mapeos**: por dominio y por modo (origen/destino) → `{ código → selector }`.
- **Portapapeles**: `{ código → { valor, timestamp } }` + TTL configurable.

---

## Instalación

1. Abre Chrome y ve a `chrome://extensions/`.  
2. Activa el **Modo Desarrollador** (arriba a la derecha).  
3. Haz clic en **Cargar descomprimida** y selecciona la carpeta `AutoComplete-Extension/`.  
4. Ahora la extensión aparecerá en la barra de Chrome.

---

## Buenas prácticas

- Usar códigos únicos y estables por campo.
- Remapear si la web cambia su DOM.
- Mantener TTL acorde al flujo de trabajo para evitar datos obsoletos.

---

## Mapa de requisitos (cobertura)

- Definir campos, tipos y código único: listo (tab Campos, filas y validaciones).
- Mapear inputs para copiar/pegar por dominio: listo (sobrescribir/añadir/borrar).
- Copiar/Pegar solo mapeados: listo.
- Persistencia y exportación: listo (storage + JSON).
- Expira datos copiados: listo (TTL configurable).
- Notificaciones claras: listo.
- Shortcuts configurables: listo (tab Atajos y Configuración).
- Tutorial inicial y ayuda: listo (tab Tutoriales).
- UI con tabs y estilos: listo (principal = Portapapeles+Acciones; Campos en filas; sin botón de info).

---

## Roadmap breve

- Soporte multiperfil de campos.
- Validadores personalizados por dominio.
- Sincronización cloud opcional.
