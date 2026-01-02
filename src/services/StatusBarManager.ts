import * as vscode from 'vscode';
import { CaptureService } from './CaptureService';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private captureService: CaptureService) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'codedraft.generateDraft';
    }

    public async update() {
        const captures = await this.captureService.getAllCaptures();
        const count = captures.length;

        if (count > 0) {
            this.statusBarItem.text = `$(notebook) ${count}`;
            this.statusBarItem.tooltip = 'CodeDraft: Generate Draft from Captures';
            this.statusBarItem.show();
        } else {
            this.statusBarItem.text = `$(eye)`;
            this.statusBarItem.tooltip = 'CodeDraft: Watching for learnings...';
            this.statusBarItem.show();
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
