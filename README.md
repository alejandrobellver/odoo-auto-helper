# Odoo Auto Helper README

Esta extensión de Visual Studio Code ayuda a automatizar tareas repetitivas en el desarrollo de proyectos (especialmente útil para desarrollo en **Odoo**).

## Características

La extensión trabaja silenciosamente en segundo plano realizando las siguientes acciones:

### 1. Gestión de Permisos
* Detecta la creación de nuevos archivos en el proyecto.
* Ejecuta automáticamente el script `set_permissions.sh` (ubicado en la raíz del workspace) de forma silenciosa para asegurar que los nuevos ficheros tengan los permisos correctos sin interrumpir tu flujo de trabajo.

### 2. Automatización de `__manifest__.py`
* **Nuevos XML:** Al crear un archivo `.xml`, la extensión busca el archivo `__manifest__.py` más cercano y añade la ruta relativa del nuevo archivo a la lista `'data'`.
* **Renombrado:** Si renombras un archivo `.xml`, la extensión actualiza automáticamente la referencia dentro del `__manifest__.py`.

### 3. Automatización de `__init__.py`
* **Nuevos Python:** Al crear un archivo `.py`, se añade automáticamente la línea de importación (`from . import nombre_archivo`) en el `__init__.py` del mismo directorio.
* Si el `__init__.py` no existe, se crea automáticamente.

## Requisitos

Para que la ejecución de permisos funcione, debe existir un archivo llamado `set_permissions.sh` en la raíz de tu carpeta de trabajo abierta en VS Code.

## Configuración

No requiere configuración adicional. Se activa automáticamente al abrir el proyecto (`onStartupFinished`).

---

**Disfruta programando sin preocuparte por los imports y permisos manuales.**