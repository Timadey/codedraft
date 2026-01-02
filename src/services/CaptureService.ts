import * as vscode from 'vscode';
import { CaptureItem, createCapture, CaptureType, CodeSnippet, CaptureContext } from '../models/CaptureItem';
import { StorageService } from './StorageService';
import { ContextExtractor } from '../utils/ContextExtractor';
import { GitService } from './GitService';
import { TelemetryService } from './TelemetryService';

export class CaptureService {
    private contextExtractor: ContextExtractor;
    private gitService: GitService;
    private _onDidCapture = new vscode.EventEmitter<void>();
    public readonly onDidCapture = this._onDidCapture.event;

    constructor(private storage: StorageService, private readonly telemetry?: TelemetryService) {
        this.contextExtractor = new ContextExtractor();
        this.gitService = new GitService();
        if (!this.telemetry) {
            this.telemetry = { sendEvent: () => Promise.resolve() } as any;
        }
    }

    async captureCodeSnippet(editor?: vscode.TextEditor, options?: { commitHash?: string, selection?: vscode.Selection }): Promise<CaptureItem | null> {
        let snippet = '';
        let selection = options?.selection;

        // 1. Check for specific commit context first (Auto-Capture)
        if (options?.commitHash) {
            const commit = await this.gitService.getLatestCommit();
            if (commit && commit.hash.startsWith(options.commitHash)) {
                // Create a commit-based capture
                const context: CaptureContext = {
                    filePath: 'commit',
                    fileName: 'commit',
                    language: 'diff',
                    commitHash: commit.hash,
                    commitMessage: commit.message,
                    diff: await this.gitService.getCommitDiff(commit.hash) || undefined
                };

                const notes = await vscode.window.showInputBox({
                    prompt: 'Add notes about this commit',
                    placeHolder: `Notes for commit: ${commit.message}`,
                    value: `Important change: ${commit.message}`
                });

                if (!notes) return null;

                const capture = createCapture('snippet', context.diff || commit.message, {
                    code: { snippet: context.diff || '', language: 'diff', filePath: 'commit', lineStart: 0, lineEnd: 0 },
                    notes,
                    context
                });

                await this.storage.saveCapture(capture);
                this._onDidCapture.fire();
                vscode.window.showInformationMessage('✅ Commit captured!');
                return capture;
            }
        }

        // 2. Handle Editor Selection
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return null;
        }

        if (!selection) {
            selection = editor.selection;
        }

        // 3. Robust fallback for empty selection
        if (selection.isEmpty) {
            // Check for uncommitted changes to suggest "whole file" or "diff"
            const changes = await this.gitService.getCurrentChanges();
            const relPath = vscode.workspace.asRelativePath(editor.document.uri);

            const isFileChanged = changes?.affectedFiles.includes(relPath);

            if (isFileChanged) {
                const action = await vscode.window.showWarningMessage(
                    'No code selected. Capture current file changes?',
                    'Capture File Changes',
                    'Cancel'
                );

                if (action === 'Capture File Changes') {
                    // Capture the diff for this file specifically if possible, or just the whole file content?
                    // For now, let's capture the whole file content as "snapshot"
                    snippet = editor.document.getText();
                    selection = new vscode.Selection(0, 0, editor.document.lineCount, 0);
                } else {
                    return null;
                }
            } else {
                vscode.window.showWarningMessage('Please select code to capture');
                return null;
            }
        } else {
            snippet = editor.document.getText(selection);
        }

        const language = editor.document.languageId;
        const filePath = vscode.workspace.asRelativePath(editor.document.uri);

        // Extract rich context
        let context: CaptureContext | undefined;
        try {
            context = await this.contextExtractor.extractContext(editor, selection);
            vscode.window.showInformationMessage('📸 Extracting context...');
        } catch (error) {
            console.warn('Failed to extract context:', error);
            // Continue without context
        }

        const notes = await vscode.window.showInputBox({
            prompt: 'Add notes about this code snippet',
            placeHolder: 'What did you learn? Why is this interesting? What problem does it solve?',
            // multiline: true
        });

        if (notes === undefined) {
            return null;
        }

        const codeSnippet: CodeSnippet = {
            snippet,
            language,
            filePath,
            lineStart: selection.start.line + 1,
            lineEnd: selection.end.line + 1
        };

        // Gather Git context if requested
        const gitOption = await vscode.window.showQuickPick([
            { label: '$(git-commit) Include Latest Commit', value: 'latest' },
            { label: '$(diff) Include Current Changes', value: 'changes' },
            { label: '$(history) Include Recent File Changes (7 days)', value: 'recent' },
            { label: '$(circle-slash) No Git Context', value: 'none' }
        ], {
            placeHolder: 'Include Git context with this capture?'
        });

        if (gitOption && gitOption.value !== 'none') {
            if (!context) context = { filePath, fileName: '', language };

            if (gitOption.value === 'latest') {
                const commit = await this.gitService.getLatestCommit();
                if (commit) {
                    context.commitHash = commit.hash.substring(0, 7);
                    context.commitMessage = commit.message;
                    context.diff = await this.gitService.getCommitDiff(commit.hash) || undefined;
                    vscode.window.showInformationMessage(`Attached commit: ${context.commitMessage}`);
                }
            } else if (gitOption.value === 'changes') {
                const changes = await this.gitService.getCurrentChanges();
                if (changes) {
                    context.diff = changes.diff;
                    context.affectedFiles = changes.affectedFiles;
                    vscode.window.showInformationMessage(`Attached uncommitted changes (${changes.affectedFiles.length} files)`);
                }
            } else if (gitOption.value === 'recent') {
                const files = await this.gitService.getRecentChanges(7);
                if (files.length > 0) {
                    context.affectedFiles = files;
                    context.diffSummary = `Recently changed files: ${files.join(', ')}`;
                    vscode.window.showInformationMessage(`Attached list of ${files.length} recently changed files`);
                }
            }
        }

        const capture = createCapture('snippet', snippet, {
            code: codeSnippet,
            notes: notes || '',
            context
        });

        await this.storage.saveCapture(capture);
        this._onDidCapture.fire();

        this.telemetry?.sendEvent('capture_created', {
            type: 'snippet',
            language: language,
            lineCount: codeSnippet.lineEnd - codeSnippet.lineStart
        });

        vscode.window.showInformationMessage('✅ Code snippet captured with context!');

        return capture;
    }

    async captureNote(): Promise<CaptureItem | null> {
        const content = await vscode.window.showInputBox({
            prompt: 'What did you learn today?',
            placeHolder: 'Enter your learning note...',
            validateInput: (value) => {
                return value.trim().length > 0 ? null : 'Note cannot be empty';
            }
        });

        if (!content) {
            return null;
        }

        // Gather Git context if requested
        const gitOption = await vscode.window.showQuickPick([
            { label: '$(git-commit) Include Latest Commit', value: 'latest' },
            { label: '$(diff) Include Current Changes', value: 'changes' },
            { label: '$(history) Include Recent File Changes (7 days)', value: 'recent' },
            { label: '$(circle-slash) No Git Context', value: 'none' }
        ], {
            placeHolder: 'Include Git context with this learning note?'
        });

        let context: CaptureContext | undefined = undefined;
        if (gitOption && gitOption.value !== 'none') {
            context = { filePath: 'note', fileName: 'note', language: 'markdown' };
            if (gitOption.value === 'latest') {
                const commit = await this.gitService.getLatestCommit();
                if (commit) {
                    context.commitHash = commit.hash.substring(0, 7);
                    context.commitMessage = commit.message;
                    context.diff = await this.gitService.getCommitDiff(commit.hash) || undefined;
                }
            } else if (gitOption.value === 'changes') {
                const changes = await this.gitService.getCurrentChanges();
                if (changes) {
                    context.diff = changes.diff;
                    context.affectedFiles = changes.affectedFiles;
                }
            } else if (gitOption.value === 'recent') {
                const files = await this.gitService.getRecentChanges(7);
                if (files.length > 0) {
                    context.affectedFiles = files;
                    context.diffSummary = `Recently changed files: ${files.join(', ')}`;
                }
            }
        }

        const capture = createCapture('learning', content, { context });
        await this.storage.saveCapture(capture);
        this._onDidCapture.fire();

        this.telemetry?.sendEvent('capture_created', {
            type: 'note',
            length: content.length
        });

        vscode.window.showInformationMessage('✅ Learning note captured!');

        return capture;
    }

    async getAllCaptures(filter?: { type?: CaptureType; days?: number }): Promise<CaptureItem[]> {
        let captures = await this.storage.loadCaptures();

        if (filter?.type) {
            captures = captures.filter(c => c.type === filter.type);
        }

        if (filter?.days) {
            const cutoff = Date.now() - (filter.days * 24 * 60 * 60 * 1000);
            captures = captures.filter(c => c.timestamp >= cutoff);
        }

        return captures.sort((a, b) => b.timestamp - a.timestamp);
    }

    async deleteCapture(id: string): Promise<void> {
        await this.storage.deleteCapture(id);
        this._onDidCapture.fire();
        vscode.window.showInformationMessage('Capture deleted');
    }
}