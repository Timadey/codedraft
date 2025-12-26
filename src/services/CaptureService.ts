import * as vscode from 'vscode';
import { CaptureItem, createCapture, CaptureType, CodeSnippet } from '../models/CaptureItem';
import { StorageService } from './StorageService';
import { ContextExtractor } from '../utils/ContextExtractor';

export class CaptureService {
    private contextExtractor: ContextExtractor;

    constructor(private storage: StorageService) {
        this.contextExtractor = new ContextExtractor();
    }

    async captureCodeSnippet(editor?: vscode.TextEditor): Promise<CaptureItem | null> {
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return null;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to capture');
            return null;
        }

        const snippet = editor.document.getText(selection);
        const language = editor.document.languageId;
        const filePath = vscode.workspace.asRelativePath(editor.document.uri);

        // Extract rich context
        let context;
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

        const capture = createCapture('snippet', snippet, {
            code: codeSnippet,
            notes: notes || '',
            context
        });

        await this.storage.saveCapture(capture);
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

        const capture = createCapture('learning', content);
        await this.storage.saveCapture(capture);
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
        vscode.window.showInformationMessage('Capture deleted');
    }
}