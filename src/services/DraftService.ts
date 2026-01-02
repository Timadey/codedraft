import * as vscode from 'vscode';
import { Draft, createDraft } from '../models/Draft';
import { StorageService } from './StorageService';
import { AIService, DraftStyle, GenerationFocus, GenerationOptions } from './AIService';
import { TelemetryService } from './TelemetryService';

export class DraftService {
    constructor(
        private storage: StorageService,
        private aiService: AIService,
        private readonly telemetry?: TelemetryService
    ) {
        if (!this.telemetry) {
            this.telemetry = { sendEvent: () => Promise.resolve() } as any;
        }
    }

    async generateDraftFromCaptures(captureIds: string[], initialOptions: GenerationOptions = {}): Promise<Draft> {
        const allCaptures = await this.storage.loadCaptures();
        const captures = allCaptures.filter(c => captureIds.includes(c.id));

        if (captures.length === 0) {
            throw new Error('No captures selected');
        }

        let style = initialOptions.style;
        let focus = initialOptions.focus;
        let customRules = initialOptions.customRules;

        // 1. Choose Focus (Universal vs Implementation)
        if (!focus) {
            const focusOptions = [
                {
                    label: '$(globe) Universal Technical Insight',
                    description: 'Broadly relatable, focus on patterns and general principles',
                    value: 'universal' as GenerationFocus
                },
                {
                    label: '$(project) Project Implementation Guide',
                    description: 'Specific to this codebase, names files and functions',
                    value: 'implementation' as GenerationFocus
                }
            ];

            const selectedFocus = await vscode.window.showQuickPick(focusOptions, {
                placeHolder: 'Choose the focus for your blog post'
            });

            if (!selectedFocus) throw new Error('No focus selected');
            focus = selectedFocus.value;
        }

        // 2. Choose Style
        if (!style) {
            const styleOptions = [
                { label: '📝 Technical', description: 'Professional and precise', value: 'technical' as DraftStyle },
                { label: '💬 Conversational', description: 'Friendly and approachable', value: 'conversational' as DraftStyle },
                { label: '📚 Tutorial', description: 'Step-by-step guide', value: 'tutorial' as DraftStyle },
                { label: '🔍 Deep Dive', description: 'Comprehensive analysis', value: 'deep-dive' as DraftStyle },
                { label: '⚡ Quick Tip', description: 'Short and actionable', value: 'quick-tip' as DraftStyle }
            ];

            const selectedStyle = await vscode.window.showQuickPick(styleOptions, {
                placeHolder: 'Choose writing style'
            });

            if (!selectedStyle) throw new Error('No style selected');
            style = selectedStyle.value;
        }

        // 3. Optional Custom Rules
        if (customRules === undefined) {
            customRules = await vscode.window.showInputBox({
                prompt: 'Any custom rules or fine-tuning instructions? (Optional)',
                placeHolder: 'e.g., "Write like a developer from the 80s", "Focus heavily on performance caveats"',
            });
        }

        const options: GenerationOptions = { style, focus, customRules };

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Generating draft with rich context...',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Generating titles...', increment: 20 });
                const titles = await this.aiService.generateTitle(captures, options);

                const selectedTitle = await vscode.window.showQuickPick(titles, {
                    placeHolder: 'Select a title for your blog post'
                });

                if (!selectedTitle) {
                    throw new Error('No title selected');
                }

                progress.report({ message: 'Creating outline...', increment: 30 });
                const outline = await this.aiService.generateOutline(captures, selectedTitle, options);

                progress.report({ message: 'Writing draft with context...', increment: 40 });
                const content = await this.aiService.generateDraft(captures, outline, selectedTitle, options);

                progress.report({ message: 'Finalizing...', increment: 10 });

                const config = vscode.workspace.getConfiguration('codedraft');
                const aiProvider = config.get('ai.provider', 'simple');
                const aiModel = config.get('ai.model', 'default');

                const draft = createDraft(selectedTitle, content, captureIds, {
                    model: `${aiProvider}/${aiModel}`,
                    prompt: `Generated with ${style} style, ${focus} focus`,
                    generatedAt: Date.now()
                });

                await this.storage.saveDraft(draft);

                // Track draft event
                this.telemetry?.sendEvent('draft_generated', {
                    style: style,
                    focus: focus,
                    wordCount: draft.metadata.wordCount,
                    provider: aiProvider
                });

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