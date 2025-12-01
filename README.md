# Odoo Auto Helper (para SGE-odoo-it-yourself)

Esta extensión de Visual Studio Code ha sido diseñada específicamente para complementar el flujo de trabajo del repositorio [SGE-odoo-it-yourself](https://github.com/javnitram/SGE-odoo-it-yourself).

Su objetivo principal es eliminar las fricciones habituales al desarrollar módulos de Odoo con Docker en entornos Linux, automatizando tareas repetitivas y de sistema.

## 🚀 Problemas que soluciona

Si estás siguiendo el curso o usando el repositorio `SGE-odoo-it-yourself`, sabrás que:
1.  Cada vez que creas archivos desde el host, a veces Docker no los lee bien y debes ejecutar `./set_permissions.sh` manualmente.
2.  Al crear una Vista (XML), debes recordar añadirla al `__manifest__.py`.
3.  Al crear un Modelo (Python), debes añadirlo al `__init__.py`.

**Esta extensión hace todo eso por ti automáticamente.**

## ✨ Características

### 1. Gestión Automática de Permisos (Docker)
Olvídate de ejecutar el script manualmente.
* **Qué hace:** Detecta cada vez que creas o renombras un archivo en el proyecto.
* **Acción:** Ejecuta silenciosamente el script `set_permissions.sh` que ya incluye el repositorio en su raíz.
* **Resultado:** Tus archivos siempre tendrán los permisos correctos para que el contenedor de Odoo los lea sin errores.

### 2. Automatización del Manifest (XML)
* **Nuevos XML:** Al crear un archivo `.xml`, la extensión busca el `__manifest__.py` de tu módulo y añade automáticamente la ruta del nuevo archivo a la lista `'data'`.
* **Renombrado:** Si cambias el nombre de un XML, se actualiza la referencia en el manifiesto.

### 3. Automatización de Imports (Python)
* **Nuevos Modelos:** Al crear un archivo `.py` dentro de una carpeta, se añade automáticamente la línea `from . import nombre_archivo` en el `__init__.py` de ese directorio.
* **Creación Inteligente:** Si el `__init__.py` no existe, la extensión lo crea por ti.

## 🛠 Requisitos

Para que la funcionalidad principal funcione, tu proyecto debe cumplir la estructura del repositorio [SGE-odoo-it-yourself](https://github.com/javnitram/SGE-odoo-it-yourself), concretamente:

1.  Debe existir el archivo `set_permissions.sh` en la raíz del área de trabajo.
2.  Debes estar trabajando en un entorno (como Linux o WSL) donde dicho script sea ejecutable.

## 📦 Instalación

1.  Descarga el archivo `.vsix` de la extensión.
2.  En VS Code, ve a Extensiones (`Ctrl+Shift+X`).
3.  Click en los tres puntos `...` > **Install from VSIX...**
4.  Selecciona el archivo descargado.

## ⚙️ Uso

No requiere configuración. Simplemente:
1.  Abre la carpeta del repositorio `SGE-odoo-it-yourself` en VS Code.
2.  Empieza a crear tus modelos y vistas dentro de `extra-addons`.
3.  Verás cómo los archivos `__manifest__.py` e `__init__.py` se rellenan solos "mágicamente".

---
**Disclaimer:** Esta es una herramienta de ayuda para estudiantes y desarrolladores que utilizan el stack SGE-odoo.