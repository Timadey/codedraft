import * as vscode from 'vscode';
import {StorageService} from './services/StorageService';
import {CaptureService} from './services/CaptureService';
import {AIService} from './services/AIService';
import {DraftService} from './services/DraftService';
import {CodeDraftTreeProvider} from './views/CodeDraftTreeProvider';
import {Draft} from './models/Draft';

export async function activate(context: vscode.ExtensionContext) {
    console.log('CodeDraft is now active!');

    try {
        // Initialize services
        const storage = new StorageService();
        await storage.initialize();

        const captureService = new CaptureService(storage);
        const aiService = new AIService();
        const draftService = new DraftService(storage, aiService);

        // Register tree view
        const treeProvider = new CodeDraftTreeProvider(captureService, storage);
        vscode.window.createTreeView('codedraftView', {
            treeDataProvider: treeProvider
        });

        // Command: Capture Code Snippet
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.captureSnippet', async () => {
                await captureService.captureCodeSnippet(vscode.window.activeTextEditor);
                treeProvider.refresh();
            })
        );

        // Command: Add Learning Note
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.addLearning', async () => {
                await captureService.captureNote();
                treeProvider.refresh();
            })
        );

        // Command: Generate Draft
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.generateDraft', async () => {
                const captures = await captureService.getAllCaptures();

                if (captures.length === 0) {
                    vscode.window.showWarningMessage('No captures available. Capture some code first!');
                    return;
                }

                // Show multi-select picker
                const items = captures.map(c => ({
                    label: c.type === 'snippet' && c.code ?
                        `${c.code.language} - ${c.code.filePath}` :
                        c.content.substring(0, 50),
                    description: c.type,
                    detail: c.notes || 'No notes',
                    picked: true, // Pre-select all
                    capture: c
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    canPickMany: true,
                    placeHolder: 'Select captures to include in the draft'
                });

                if (!selected || selected.length === 0) {
                    return;
                }

                const captureIds = selected.map(s => s.capture.id);

                try {
                    const draft = await draftService.generateDraftFromCaptures(captureIds);
                    vscode.window.showInformationMessage(`✨ Draft created: ${draft.title}`);

                    // Open draft
                    await vscode.commands.executeCommand('codedraft.openDraft', draft);

                    // Refresh tree
                    treeProvider.refresh();
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to generate draft: ${error.message}`);
                }
            })
        );

        // Command: Open Draft
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.openDraft', async (draft?: Draft) => {
                if (!draft) {
                    const drafts = await draftService.loadDrafts();
                    if (drafts.length === 0) {
                        vscode.window.showInformationMessage('No drafts yet. Generate one first!');
                        return;
                    }

                    const items = drafts.map(d => ({
                        label: d.title,
                        description: `${d.status} • ${d.metadata.wordCount} words`,
                        draft: d
                    }));

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a draft to open'
                    });

                    if (!selected) return;
                    draft = selected.draft;
                }

                // Open in new editor
                const doc = await vscode.workspace.openTextDocument({
                    content: draft.content,
                    language: 'markdown'
                });

                await vscode.window.showTextDocument(doc);
            })
        );

        // Command: Delete Capture
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.deleteCapture', async (treeItem: any) => {
                if (treeItem?.capture) {
                    const confirm = await vscode.window.showWarningMessage(
                        'Delete this capture?',
                        'Delete',
                        'Cancel'
                    );

                    if (confirm === 'Delete') {
                        await captureService.deleteCapture(treeItem.capture.id);
                        treeProvider.refresh();
                    }
                }
            })
        );

        // Command: Delete Draft
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.deleteDraft', async (treeItem: any) => {
                if (treeItem?.draft) {
                    const confirm = await vscode.window.showWarningMessage(
                        `Delete draft "${treeItem.draft.title}"?`,
                        'Delete',
                        'Cancel'
                    );

                    if (confirm === 'Delete') {
                        await draftService.deleteDraft(treeItem.draft.id);
                        treeProvider.refresh();
                    }
                }
            })
        );

        // Command: Export Draft
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.exportDraft', async (treeItem: any) => {
                if (treeItem?.draft) {
                    await draftService.exportToClipboard(treeItem.draft);
                }
            })
        );

        // Command: Weekly Review
        context.subscriptions.push(
            vscode.commands.registerCommand('codedraft.weeklyReview', async () => {
                const captures = await captureService.getAllCaptures({ days: 7 });

                if (captures.length === 0) {
                    vscode.window.showInformationMessage('No learnings captured this week. Start capturing!');
                    return;
                }

                const action = await vscode.window.showInformationMessage(
                    `📚 You captured ${captures.length} learnings this week!`,
                    'Generate Draft',
                    'View Captures'
                );

                if (action === 'Generate Draft') {
                    await vscode.commands.executeCommand('codedraft.generateDraft');
                } else if (action === 'View Captures') {
                    await vscode.commands.executeCommand('workbench.view.extension.codedraft');
                }
            })
        );

        vscode.window.showInformationMessage('🚀 CodeDraft is ready! Press Ctrl+Shift+C to capture code.');

    } catch (error: any) {
        vscode.window.showErrorMessage(`CodeDraft failed to activate: ${error.message}`);
        console.error('CodeDraft activation error:', error);
    }
}

export function deactivate() {
    console.log('CodeDraft deactivated');
}