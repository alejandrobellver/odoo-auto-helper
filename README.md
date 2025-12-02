# Odoo Auto Helper (para SGE-odoo-it-yourself)

Esta extensión de Visual Studio Code es el compañero esencial para el repositorio [SGE-odoo-it-yourself](https://github.com/javnitram/SGE-odoo-it-yourself).

Su misión es automatizar el mantenimiento del contenedor y la gestión de archivos de Odoo, solucionando los problemas de permisos y el **Error 500** habitual al desarrollar "en caliente".

## 🚀 Problemas que soluciona

1.  **Error 500 / Internal Server Error:** Odoo necesita reiniciarse para detectar correctamente cambios en permisos o nuevos archivos Python compilados. Hacerlo a mano es lento.
2.  **Permisos de Docker:** Los archivos creados desde el host (VS Code) a veces son ilegibles para el contenedor.
3.  **Boilerplate repetitivo:** Olvidar añadir una vista al `__manifest__.py` o un modelo al `__init__.py` es la causa #1 de errores "View not found".

## ✨ Características Principales

### 1. Gestión Inteligente del Servidor (Docker + Permisos)
La extensión vigila tus movimientos de archivos y actúa automáticamente:

* **Espera Inteligente (Debounce):** Al crear, borrar o renombrar archivos, la extensión espera **2 segundos** de inactividad. Esto te permite pegar o mover múltiples archivos sin saturar el sistema.
* **Ejecución Nativa:** Ejecuta `./set_permissions.sh` usando una shell `bash` real para asegurar que los permisos se apliquen correctamente.
* **Auto-Reinicio de Odoo:** Una vez aplicados los permisos, ejecuta automáticamente `docker compose restart odoo`. **Esto previene el error 500**, asegurando que Odoo cargue los nuevos archivos correctamente.

### 2. Automatización del Manifest (XML)
* **Creación:** Al crear un `.xml`, busca el `__manifest__.py` más cercano y lo añade a la lista `'data'`.
* **Borrado:** Si eliminas un `.xml`, la extensión limpia la línea correspondiente en el `__manifest__.py`.
* **Renombrado:** Actualiza la referencia automáticamente.

### 3. Automatización de Imports (Python)
* **Creación:** Al crear un `.py`, añade `from . import nombre_archivo` en el `__init__.py` local (y lo crea si falta).
* **Borrado:** Si eliminas un `.py`, borra su línea de importación en el `__init__.py`.
* **Renombrado:** Quita el import viejo y añade el nuevo.

## 🛠 Requisitos Técnicos

Para que la magia funcione, tu entorno debe cumplir:

1.  **Estructura del Proyecto:** Debe existir `set_permissions.sh` y `docker-compose.yml` en la raíz.
2.  **Nombre del Servicio:** El servicio en el docker-compose debe llamarse `odoo` (el estándar del repo de clase).
3.  **Entorno:** Sistema operativo Linux, macOS o Windows con WSL2 (necesario para ejecutar scripts bash y docker).

## 📦 Instalación

1.  Descarga el archivo `.vsix` del último Release.
2.  En VS Code: Panel de Extensiones (`Ctrl+Shift+X`) > Menú `...` > **Install from VSIX...**
3.  Selecciona el archivo descargado.

## ⚙️ Uso

Simplemente trabaja en tu proyecto.
* Cuando veas en la barra de estado de VS Code el mensaje: **"$(check) Odoo: Permisos OK y Reiniciado"**, sabrás que tu entorno está listo para probar los cambios.

---
**Nota:** Dado que la extensión reinicia el contenedor de Odoo tras los cambios de estructura, es normal que la web de Odoo tarde unos segundos en responder inmediatamente después de crear un archivo nuevo.
