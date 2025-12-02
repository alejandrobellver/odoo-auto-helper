import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let permissionTimeout: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    const createWatcher = vscode.workspace.onDidCreateFiles(async (event) => {
        triggerPermissionsScript();
        for (const file of event.files) {
            if (shouldIgnore(file.fsPath)) continue;

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
        triggerPermissionsScript();
        for (const file of event.files) {
            if (shouldIgnore(file.newUri.fsPath)) continue;

            const oldExt = path.extname(file.oldUri.fsPath);
            const newExt = path.extname(file.newUri.fsPath);

            if (oldExt === '.xml') await removeFromManifest(file.oldUri.fsPath);
            if (newExt === '.xml') await addToManifest(file.newUri.fsPath);
            
            if (oldExt === '.py' && !file.oldUri.fsPath.endsWith('__init__.py')) await removeFromInit(file.oldUri.fsPath);
            if (newExt === '.py' && !file.newUri.fsPath.endsWith('__init__.py')) await addToInit(file.newUri.fsPath);
        }
    });

    const deleteWatcher = vscode.workspace.onDidDeleteFiles(async (event) => {
        triggerPermissionsScript();
        for (const file of event.files) {
            if (shouldIgnore(file.fsPath)) continue;

            const ext = path.extname(file.fsPath);
            if (ext === '.xml') {
                await removeFromManifest(file.fsPath);
            } else if (ext === '.py' && !file.fsPath.endsWith('__init__.py')) {
                await removeFromInit(file.fsPath);
            }
        }
    });

    context.subscriptions.push(createWatcher, renameWatcher, deleteWatcher);
}

function shouldIgnore(filePath: string): boolean {
    return filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('__pycache__');
}

function triggerPermissionsScript() {
    if (permissionTimeout) {
        clearTimeout(permissionTimeout);
    }
    permissionTimeout = setTimeout(() => {
        runPermissionsScript();
    }, 1000);
}

function runPermissionsScript() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(rootPath, 'set_permissions.sh');

    if (fs.existsSync(scriptPath)) {
        cp.exec(`sh "${scriptPath}"`, { cwd: rootPath }, (err) => {
            if (err) console.error(err);
        });
    }
}

async function addToManifest(xmlPath: string) {
    const manifestPath = findNearestFile(path.dirname(xmlPath), '__manifest__.py');
    if (!manifestPath) return;

    const relativePath = path.relative(path.dirname(manifestPath), xmlPath).split(path.sep).join('/');
    
    const doc = await vscode.workspace.openTextDocument(manifestPath);
    const text = doc.getText();

    if (text.includes(relativePath)) return;

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
    if (!manifestPath) return;

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

async function removeFromInit(pyPath: string) {
    const dir = path.dirname(pyPath);
    const initPath = path.join(dir, '__init__.py');
    const moduleName = path.basename(pyPath, '.py');
    const importLine = `from . import ${moduleName}`;

    if (!fs.existsSync(initPath)) return;

    const doc = await vscode.workspace.openTextDocument(initPath);
    const text = doc.getText();

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