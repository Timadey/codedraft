import * as vscode from 'vscode';
import { CaptureItem } from '../models/CaptureItem';
import { Draft } from '../models/Draft';
import { CaptureService } from '../services/CaptureService';
import { StorageService } from '../services/StorageService';

export class CodeDraftTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private captureService: CaptureService,
        private storage: StorageService
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            return [
                new SectionItem('captures', 'Recent Captures', vscode.TreeItemCollapsibleState.Expanded),
                new SectionItem('drafts', 'Drafts', vscode.TreeItemCollapsibleState.Expanded)
            ];
        }

        if (element instanceof SectionItem) {
            if (element.section === 'captures') {
                return this.getCaptureItems();
            } else if (element.section === 'drafts') {
                return this.getDraftItems();
            }
        }

        return [];
    }

    private async getCaptureItems(): Promise<TreeItem[]> {
        const captures = await this.captureService.getAllCaptures({ days: 30 });
        return captures.slice(0, 20).map(c => new CaptureTreeItem(c));
    }

    private async getDraftItems(): Promise<TreeItem[]> {
        const drafts = await this.storage.loadDrafts();
        return drafts.map(d => new DraftTreeItem(d));
    }
}

type TreeItem = SectionItem | CaptureTreeItem | DraftTreeItem;

class SectionItem extends vscode.TreeItem {
    constructor(
        public section: 'captures' | 'drafts',
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.contextValue = section;
    }
}

class CaptureTreeItem extends vscode.TreeItem {
    constructor(public capture: CaptureItem) {
        super(
            CaptureTreeItem.getLabel(capture),
            vscode.TreeItemCollapsibleState.None
        );

        const date = new Date(capture.timestamp);
        this.description = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        this.tooltip = `${capture.type}: ${capture.content.substring(0, 100)}...\n\nNotes: ${capture.notes}`;
        this.contextValue = 'capture';
        this.iconPath = CaptureTreeItem.getIcon(capture.type);
    }

    static getLabel(capture: CaptureItem): string {
        if (capture.type === 'snippet' && capture.code) {
            return `${capture.code.language} - ${capture.code.filePath}`;
        }
        return capture.content.substring(0, 50) + (capture.content.length > 50 ? '...' : '');
    }

    static getIcon(type: string): vscode.ThemeIcon {
        const iconMap: Record<string, string> = {
            snippet: 'code',
            commit: 'git-commit',
            note: 'note',
            learning: 'lightbulb'
        };
        return new vscode.ThemeIcon(iconMap[type] || 'file');
    }
}

class DraftTreeItem extends vscode.TreeItem {
    constructor(public draft: Draft) {
        super(draft.title, vscode.TreeItemCollapsibleState.None);

        this.description = `${draft.metadata.wordCount} words`;
        this.tooltip = `Status: ${draft.status}\nRead time: ${draft.metadata.estimatedReadTime} min`;
        this.contextValue = 'draft';
        this.iconPath = DraftTreeItem.getIcon(draft.status);

        this.command = {
            command: 'codedraft.openDraft',
            title: 'Open Draft',
            arguments: [draft]
        };
    }

    static getIcon(status: string): vscode.ThemeIcon {
        const iconMap: Record<string, string> = {
            draft: 'edit',
            ready: 'check',
            published: 'rocket'
        };
        return new vscode.ThemeIcon(iconMap[status] || 'file');
    }
}