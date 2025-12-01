import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Project Auto Helper está activo.');

    const createWatcher = vscode.workspace.onDidCreateFiles(async (event) => {
        if (event.files.length > 0) {
            runPermissionsScript();
        }

        for (const file of event.files) {
            const ext = path.extname(file.fsPath);
            const filename = path.basename(file.fsPath);

            if (ext === '.xml') {
                await addToManifest(file.fsPath);
            } else if (ext === '.py' && filename !== '__init__.py' && filename !== '__manifest__.py') {
                await addToInit(file.fsPath);
            }
        }
    });

    const renameWatcher = vscode.workspace.onDidRenameFiles(async (event) => {
        runPermissionsScript();

        for (const file of event.files) {
            const oldExt = path.extname(file.oldUri.fsPath);
            const newExt = path.extname(file.newUri.fsPath);

            if (oldExt === '.xml' || newExt === '.xml') {
                await updateManifestRename(file.oldUri.fsPath, file.newUri.fsPath);
            }
            
            if (newExt === '.py' && !file.newUri.fsPath.endsWith('__init__.py')) {
                await addToInit(file.newUri.fsPath);
            }
        }
    });

    context.subscriptions.push(createWatcher, renameWatcher);
}

function runPermissionsScript() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(rootPath, 'set_permissions.sh');

    if (fs.existsSync(scriptPath)) {
        // exec se ejecuta en segundo plano, no abre terminal UI
        cp.exec(`sh "${scriptPath}"`, { cwd: rootPath }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error ejecutando permisos: ${err.message}`);
            }
        });
    }
}

async function addToManifest(xmlPath: string) {
    const manifestPath = findNearestFile(path.dirname(xmlPath), '__manifest__.py');
    if (!manifestPath) return;

    const relativePath = path.relative(path.dirname(manifestPath), xmlPath).replace(/\\/g, '/');
    
    const doc = await vscode.workspace.openTextDocument(manifestPath);
    const text = doc.getText();

    const dataRegex = /('data'\s*:\s*\[)([^\]]*)(\])/s;
    const match = dataRegex.exec(text);

    if (match) {
        if (match[2].includes(relativePath)) return;

        const edit = new vscode.WorkspaceEdit();
        const insertPos = doc.positionAt(match.index + match[1].length);
        
        const stringToInsert = `\n        '${relativePath}',`;
        
        edit.insert(doc.uri, insertPos, stringToInsert);
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

async function updateManifestRename(oldPath: string, newPath: string) {
    const manifestPath = findNearestFile(path.dirname(oldPath), '__manifest__.py');
    if (!manifestPath) return;

    const oldRel = path.relative(path.dirname(manifestPath), oldPath).replace(/\\/g, '/');
    const newRel = path.relative(path.dirname(manifestPath), newPath).replace(/\\/g, '/');

    const doc = await vscode.workspace.openTextDocument(manifestPath);
    const text = doc.getText();

    if (text.includes(oldRel)) {
        const edit = new vscode.WorkspaceEdit();
        const newText = text.replace(oldRel, newRel);
        const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(text.length)
        );
        edit.replace(doc.uri, fullRange, newText);
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    } else {
        await addToManifest(newPath);
    }
}

async function addToInit(pyPath: string) {
    const dir = path.dirname(pyPath);
    const initPath = path.join(dir, '__init__.py');
    const moduleName = path.basename(pyPath, '.py');
    const importLine = `from . import ${moduleName}`;

    if (!fs.existsSync(initPath)) {
        fs.writeFileSync(initPath, '');
    }

    const doc = await vscode.workspace.openTextDocument(initPath);
    const text = doc.getText();

    if (!text.includes(importLine)) {
        const edit = new vscode.WorkspaceEdit();
        const pos = doc.positionAt(text.length);
        const prefix = (text.length > 0 && !text.endsWith('\n')) ? '\n' : '';
        
        edit.insert(doc.uri, pos, `${prefix}${importLine}\n`);
        await vscode.workspace.applyEdit(edit);
        await doc.save();
    }
}

function findNearestFile(startDir: string, filename: string): string | null {
    const currentPath = path.join(startDir, filename);
    if (fs.existsSync(currentPath)) {
        return currentPath;
    }
    const parentDir = path.dirname(startDir);
    if (parentDir === startDir) return null;
    return findNearestFile(parentDir, filename);
}

export function deactivate() {}