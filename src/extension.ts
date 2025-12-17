import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let permissionTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    // 1. EVENTO: CREACIÓN
    const createWatcher = vscode.workspace.onDidCreateFiles(async (event) => {
        triggerAction(); // Reinicia el contador para el script de permisos
        
        for (const file of event.files) {
            if (shouldIgnore(file.fsPath)) {continue;}

            const ext = path.extname(file.fsPath);
            const filename = path.basename(file.fsPath);

            if (ext === '.xml') {
                // Nuevo XML -> al Manifest
                await addToManifest(file.fsPath);
            } 
            else if (filename === '__init__.py') {
                // SCALFFOLD DETECTADO: Se ha creado un __init__.py.
                // Significa que la carpeta que lo contiene es un paquete python.
                // Debemos registrar esta carpeta en el __init__.py del PADRE.
                await registerPackageInParent(file.fsPath);
            }
            else if (ext === '.py' && filename !== '__manifest__.py') {
                // Nuevo archivo Python normal -> al __init__.py de su misma carpeta
                await addFileToCurrentInit(file.fsPath);
            }
        }
    });

    // 2. EVENTO: RENOMBRADO
    const renameWatcher = vscode.workspace.onDidRenameFiles(async (event) => {
        triggerAction();
        for (const file of event.files) {
            if (shouldIgnore(file.newUri.fsPath)) {continue;}

            const oldExt = path.extname(file.oldUri.fsPath);
            const newExt = path.extname(file.newUri.fsPath);

            // Gestión XML (Manifest)
            if (oldExt === '.xml') {await removeFromManifest(file.oldUri.fsPath);}
            if (newExt === '.xml') {await addToManifest(file.newUri.fsPath);}
            
            // Gestión Python (Archivos y Carpetas)
            // Si cambia nombre, lo quitamos del init viejo y lo ponemos en el nuevo
            await handlePythonRename(file.oldUri.fsPath, file.newUri.fsPath);
        }
    });

    // 3. EVENTO: BORRADO
    const deleteWatcher = vscode.workspace.onDidDeleteFiles(async (event) => {
        triggerAction();
        for (const file of event.files) {
            if (shouldIgnore(file.fsPath)) {continue;}

            const ext = path.extname(file.fsPath);
            
            if (ext === '.xml') {
                await removeFromManifest(file.fsPath);
            } else {
                // Si no es XML, asumimos que puede ser un .py o una CARPETA (package)
                // Intentamos eliminar su referencia del __init__.py del padre.
                // Esto funciona tanto para 'archivo.py' como para la carpeta 'models'
                await removeReferenceFromParentInit(file.fsPath);
            }
        }
    });

    context.subscriptions.push(createWatcher, renameWatcher, deleteWatcher);
}

function shouldIgnore(filePath: string): boolean {
    return filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('__pycache__');
}

// --- LOGICA DE EJECUCION (DEBOUNCE) ---
function triggerAction() {
    if (permissionTimeout) {
        clearTimeout(permissionTimeout);
    }
    // Espera 2 segundos tras el último cambio (ideal para scaffolds grandes)
    permissionTimeout = setTimeout(() => {
        runPermissionsAndRestart();
    }, 2000);
}

function runPermissionsAndRestart() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {return;}

    const rootPath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(rootPath, 'set_permissions.sh');

    if (fs.existsSync(scriptPath)) {
        try {
            fs.chmodSync(scriptPath, '755');
            // Ejecutamos script y reiniciamos. 
            // set_permissions arregla permisos de los archivos nuevos creados por scaffold.
            const command = `./set_permissions.sh && docker compose restart odoo`;

            console.log('Ejecutando mantenimiento Odoo (Permisos + Restart)...');
            
            cp.exec(command, { cwd: rootPath, shell: '/bin/bash' }, (err, stdout, stderr) => {
                if (err) {
                    console.error('Error crítico:', stderr);
                    vscode.window.showErrorMessage('Error al ejecutar permisos. Revisa consola.');
                } else {
                    console.log(stdout);
                    vscode.window.setStatusBarMessage('$(check) Odoo: Scaffold procesado y Reiniciado', 4000);
                }
            });

        } catch (error: any) {
            // Silencioso o log a consola
            console.error(error);
        }
    } 
}

// --- LOGICA MANIFEST (XML) ---

async function addToManifest(xmlPath: string) {
    const manifestPath = findNearestFile(path.dirname(xmlPath), '__manifest__.py');
    if (!manifestPath) {return;}

    const relativePath = path.relative(path.dirname(manifestPath), xmlPath).split(path.sep).join('/');
    
    const doc = await vscode.workspace.openTextDocument(manifestPath);
    const text = doc.getText();

    if (text.includes(relativePath)) {return;}

    const dataRegex = /('data'\s*:\s*\[)([^\]]*)(\])/s;
    const match = dataRegex.exec(text);

    if (match) {
        const edit = new vscode.WorkspaceEdit();
        const insertPos = doc.positionAt(match.index + match[1].length);
        const stringToInsert = `\n        '${relativePath}',`;
        edit.insert(doc.uri, insertPos, stringToInsert);
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

async function removeFromManifest(xmlPath: string) {
    const manifestPath = findNearestFile(path.dirname(xmlPath), '__manifest__.py');
    if (!manifestPath) {return;}

    const relativePath = path.relative(path.dirname(manifestPath), xmlPath).split(path.sep).join('/');
    
    const doc = await vscode.workspace.openTextDocument(manifestPath);
    const text = doc.getText();

    const lines = text.split('\n');
    const newLines = lines.filter(line => !line.includes(`'${relativePath}'`) && !line.includes(`"${relativePath}"`));

    if (lines.length !== newLines.length) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length));
        edit.replace(doc.uri, fullRange, newLines.join('\n'));
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

// --- LOGICA PYTHON (INIT) ---

/**
 * Caso 1: Archivo .py nuevo en una carpeta.
 * Acción: Añadir 'from . import archivo' al __init__.py de ESA carpeta.
 */
async function addFileToCurrentInit(filePath: string) {
    const dir = path.dirname(filePath);
    const initPath = path.join(dir, '__init__.py');
    
    // REGLA: Si no existe __init__.py, NO lo creamos (petición usuario)
    if (!fs.existsSync(initPath)) {return;}

    const moduleName = path.basename(filePath, '.py');
    await appendImportToInit(initPath, moduleName);
}

/**
 * Caso 2: Se crea un __init__.py nuevo (Scaffold de carpeta).
 * Acción: La carpeta que lo contiene ahora es un paquete. 
 * Hay que añadir 'from . import carpeta' al __init__.py del PADRE.
 */
async function registerPackageInParent(initFilePath: string) {
    const currentFolder = path.dirname(initFilePath); // ej: .../models
    const parentFolder = path.dirname(currentFolder); // ej: .../modulo
    const parentInitPath = path.join(parentFolder, '__init__.py'); // ej: .../modulo/__init__.py
    
    if (!fs.existsSync(parentInitPath)) {return;}

    const folderName = path.basename(currentFolder); // ej: models
    await appendImportToInit(parentInitPath, folderName);
}

/**
 * Función genérica para borrar imports al borrar archivos O carpetas.
 * Si borras 'models/models.py' -> busca 'models' en el init de 'models/'
 * Si borras la carpeta 'models/' -> busca 'models' en el init del padre.
 */
async function removeReferenceFromParentInit(deletedPath: string) {
    const parentDir = path.dirname(deletedPath);
    const parentInit = path.join(parentDir, '__init__.py');

    if (!fs.existsSync(parentInit)) {return;}

    // Detectamos el nombre del import. 
    // Si era 'archivo.py', el nombre es 'archivo'.
    // Si era carpeta 'models', el nombre es 'models'.
    let moduleName = path.basename(deletedPath);
    if (moduleName.endsWith('.py')) {
        moduleName = moduleName.substring(0, moduleName.length - 3);
    }

    const doc = await vscode.workspace.openTextDocument(parentInit);
    const text = doc.getText();
    const importLine = `from . import ${moduleName}`;

    const lines = text.split('\n');
    const newLines = lines.filter(line => !line.trim().startsWith(importLine));

    if (lines.length !== newLines.length) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length));
        edit.replace(doc.uri, fullRange, newLines.join('\n'));
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

// Helper para escribir en init
async function appendImportToInit(initPath: string, moduleName: string) {
    const doc = await vscode.workspace.openTextDocument(initPath);
    const text = doc.getText();
    const importLine = `from . import ${moduleName}`;

    if (!text.includes(importLine)) {
        const edit = new vscode.WorkspaceEdit();
        const pos = doc.positionAt(text.length);
        const prefix = (text.length > 0 && !text.endsWith('\n')) ? '\n' : '';
        
        edit.insert(doc.uri, pos, `${prefix}${importLine}\n`);
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

async function handlePythonRename(oldPath: string, newPath: string) {
    // 1. Borrar referencia antigua
    await removeReferenceFromParentInit(oldPath);
    
    // 2. Añadir referencia nueva
    const newFilename = path.basename(newPath);
    if (newFilename === '__init__.py') {
        // Se ha movido/renombrado un init (una carpeta entera probablemente)
        await registerPackageInParent(newPath);
    } else if (newFilename.endsWith('.py')) {
        await addFileToCurrentInit(newPath);
    }
}

// Utilidad recursiva
function findNearestFile(startDir: string, filename: string): string | null {
    const currentPath = path.join(startDir, filename);
    if (fs.existsSync(currentPath)) {
        return currentPath;
    }
    const parentDir = path.dirname(startDir);
    if (parentDir === startDir) {return null;}
    return findNearestFile(parentDir, filename);
}

export function deactivate() {}