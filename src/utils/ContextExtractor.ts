import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CaptureContext } from '../models/CaptureItem';

export class ContextExtractor {

    /**
     * Extract rich context from editor and workspace
     */
    async extractContext(editor: vscode.TextEditor, selection: vscode.Selection): Promise<CaptureContext> {
        const document = editor.document;
        const context: CaptureContext = {
            filePath: vscode.workspace.asRelativePath(document.uri),
            fileName: path.basename(document.uri.fsPath),
            language: document.languageId
        };

        // Get surrounding code
        context.surroundingCode = await this.getSurroundingCode(document, selection);

        // Extract function/class name
        const symbols = await this.getSymbolContext(document, selection.start);
        context.functionName = symbols.functionName;
        context.className = symbols.className;

        // Get project context
        const projectContext = await this.getProjectContext();
        context.projectDeps = projectContext.dependencies;
        context.framework = projectContext.framework;
        context.projectDescription = projectContext.description;

        // Get Git context
        const gitContext = await this.getGitContext(document.uri);
        context.commitHash = gitContext.hash;
        context.commitMessage = gitContext.message;

        return context;
    }

    /**
     * Get lines before and after the selection for context
     */
    private async getSurroundingCode(
        document: vscode.TextDocument,
        selection: vscode.Selection,
        linesBefore: number = 10,
        linesAfter: number = 10
    ): Promise<string> {
        const startLine = Math.max(0, selection.start.line - linesBefore);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + linesAfter);

        const beforeRange = new vscode.Range(startLine, 0, selection.start.line, 0);
        const afterRange = new vscode.Range(selection.end.line + 1, 0, endLine + 1, 0);

        const before = document.getText(beforeRange);
        const after = document.getText(afterRange);

        return `// ... lines ${startLine + 1}-${selection.start.line}\n${before}\n// [CAPTURED CODE]\n${after}\n// ... lines ${selection.end.line + 2}-${endLine + 1}`;
    }

    /**
     * Get function/class name containing the selection
     */
    private async getSymbolContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<{ functionName?: string; className?: string }> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols) return {};

            // Find innermost symbol containing position
            const findSymbol = (
                syms: vscode.DocumentSymbol[],
                depth: number = 0
            ): { functionName?: string; className?: string } => {
                for (const symbol of syms) {
                    if (symbol.range.contains(position)) {
                        const result: { functionName?: string; className?: string } = {};

                        if (symbol.kind === vscode.SymbolKind.Function ||
                            symbol.kind === vscode.SymbolKind.Method) {
                            result.functionName = symbol.name;
                        }

                        if (symbol.kind === vscode.SymbolKind.Class) {
                            result.className = symbol.name;
                        }

                        // Recurse into children
                        if (symbol.children && symbol.children.length > 0) {
                            const childResult = findSymbol(symbol.children, depth + 1);
                            return { ...result, ...childResult };
                        }

                        return result;
                    }
                }
                return {};
            };

            return findSymbol(symbols);
        } catch (error) {
            return {};
        }
    }

    /**
     * Extract project metadata from package.json, README, etc.
     */
    private async getProjectContext(): Promise<{
        dependencies?: string[];
        framework?: string;
        description?: string;
    }> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return {};

        const result: {
            dependencies?: string[];
            framework?: string;
            description?: string;
        } = {};

        // Try to read package.json
        try {
            const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);

            // Get dependencies
            const deps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            result.dependencies = Object.keys(deps).slice(0, 10); // Top 10

            // Detect framework
            if (deps.react) result.framework = 'React';
            else if (deps.vue) result.framework = 'Vue';
            else if (deps['@angular/core']) result.framework = 'Angular';
            else if (deps.svelte) result.framework = 'Svelte';
            else if (deps.next) result.framework = 'Next.js';
            else if (deps.express) result.framework = 'Express';

            result.description = packageJson.description;
        } catch (e) {
            // No package.json or parse error
        }

        // Try to read README
        try {
            const readmePath = path.join(workspaceFolder.uri.fsPath, 'README.md');
            const readmeContent = await fs.readFile(readmePath, 'utf8');

            // Extract first paragraph or title
            const lines = readmeContent.split('\n').filter(l => l.trim());
            if (lines.length > 0 && !result.description) {
                // Skip title line, get first content
                const descLine = lines.find(l => !l.startsWith('#'));
                if (descLine) {
                    result.description = descLine.substring(0, 200);
                }
            }
        } catch (e) {
            // No README
        }

        return result;
    }

    /**
     * Get Git context for a file
     */
    private async getGitContext(uri: vscode.Uri): Promise<{
        hash?: string;
        message?: string;
    }> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) return {};

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories?.[0];
            if (!repo) return {};

            // Get latest commit
            const commits = await repo.log({ maxEntries: 1 });
            if (commits && commits.length > 0) {
                const commit = commits[0];
                return {
                    hash: commit.hash.substring(0, 7),
                    message: commit.message.split('\n')[0]
                };
            }
        } catch (error) {
            // Git not available
        }

        return {};
    }

    /**
     * Extract context from a commit
     */
    async extractCommitContext(commitHash: string): Promise<Partial<CaptureContext>> {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) return {};

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories?.[0];
            if (!repo) return {};

            const commit = await repo.getCommit(commitHash);

            return {
                commitHash: commitHash.substring(0, 7),
                commitMessage: commit.message,
                // Note: Getting diff requires more complex API calls
                // For now, just basic info
            };
        } catch (error) {
            return {};
        }
    }
}