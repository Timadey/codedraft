import * as vscode from 'vscode';
import { Draft, createDraft } from '../models/Draft';
import { StorageService } from './StorageService';
import { AIService, DraftStyle } from './AIService';

export class DraftService {
    constructor(
        private storage: StorageService,
        private aiService: AIService
    ) {}

    async generateDraftFromCaptures(captureIds: string[], style?: DraftStyle): Promise<Draft> {
        const allCaptures = await this.storage.loadCaptures();
        const captures = allCaptures.filter(c => captureIds.includes(c.id));

        if (captures.length === 0) {
            throw new Error('No captures selected');
        }

        // Ask user to select style if not provided
        if (!style) {
            const styleOptions = [
                { label: '📝 Technical', description: 'Professional and precise', value: 'technical' as DraftStyle },
                { label: '💬 Conversational', description: 'Friendly and approachable', value: 'conversational' as DraftStyle },
                { label: '📚 Tutorial', description: 'Step-by-step guide', value: 'tutorial' as DraftStyle },
                { label: '🔍 Deep Dive', description: 'Comprehensive analysis', value: 'deep-dive' as DraftStyle },
                { label: '⚡ Quick Tip', description: 'Short and actionable', value: 'quick-tip' as DraftStyle }
            ];

            const selected = await vscode.window.showQuickPick(styleOptions, {
                placeHolder: 'Choose writing style for your draft'
            });

            if (!selected) {
                throw new Error('No style selected');
            }

            style = selected.value;
        }

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating draft with rich context...',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Generating titles...', increment: 20 });
                const titles = await this.aiService.generateTitle(captures, style);

                const selectedTitle = await vscode.window.showQuickPick(titles, {
                    placeHolder: 'Select a title for your blog post'
                });

                if (!selectedTitle) {
                    throw new Error('No title selected');
                }

                progress.report({ message: 'Creating outline...', increment: 30 });
                const outline = await this.aiService.generateOutline(captures, selectedTitle, style);

                progress.report({ message: 'Writing draft with context...', increment: 40 });
                const content = await this.aiService.generateDraft(captures, outline, selectedTitle, style);

                progress.report({ message: 'Finalizing...', increment: 10 });

                const config = vscode.workspace.getConfiguration('codedraft');
                const aiProvider = config.get('ai.provider', 'simple');
                const aiModel = config.get('ai.model', 'default');

                const draft = createDraft(selectedTitle, content, captureIds, {
                    model: `${aiProvider}/${aiModel}`,
                    prompt: `Generated with ${style} style`,
                    generatedAt: Date.now()
                });

                await this.storage.saveDraft(draft);
                return draft;
            }
        );
    }

    async loadDrafts(): Promise<Draft[]> {
        return await this.storage.loadDrafts();
    }

    async loadDraft(id: string): Promise<Draft | null> {
        return await this.storage.loadDraft(id);
    }

    async deleteDraft(id: string): Promise<void> {
        await this.storage.deleteDraft(id);
        vscode.window.showInformationMessage('Draft deleted');
    }

    async exportToClipboard(draft: Draft): Promise<void> {
        await vscode.env.clipboard.writeText(draft.content);
        vscode.window.showInformationMessage('✅ Draft copied to clipboard!');
    }
}