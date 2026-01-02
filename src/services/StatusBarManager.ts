import * as vscode from 'vscode';
import { CaptureService } from './CaptureService';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private sessionStart: number;
    private capturesThisSession: number = 0;
    private updateInterval: NodeJS.Timeout;

    constructor(private captureService: CaptureService) {
        this.sessionStart = Date.now();
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'codedraft.showQuickMenu';

        // Update every minute for session time
        this.updateInterval = setInterval(() => this.update(), 60000);

        // Listen for capture events
        this.captureService.onDidCapture(() => {
            this.capturesThisSession++;
            this.update();
        });
    }

    public async update() {
        const captures = await this.captureService.getAllCaptures();
        const count = captures.length;

        // Calculate session stats
        const sessionDuration = Date.now() - this.sessionStart;
        const sessionHours = Math.floor(sessionDuration / (1000 * 60 * 60));
        const sessionMinutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

        // Smart icon based on state
        let icon = '$(notebook)';
        let text = '';
        let tooltip = '';

        if (count === 0) {
            icon = '$(eye)';
            text = '';
            tooltip = 'CodeDraft: Watching for learnings...\nCapture code with Ctrl+Shift+C';
        } else if (count < 3) {
            icon = '$(notebook)';
            text = `${count} captures`;
            tooltip = `CodeDraft: ${count} capture${count > 1 ? 's' : ''}\nAdd more to generate a quality draft`;
        } else if (count < 5) {
            icon = '$(notebook)';
            text = `${count} captures`;
            tooltip = `CodeDraft: ${count} captures\nAlmost ready for a draft! (3-5 is ideal)`;
        } else {
            icon = '$(sparkle)'; // Ready indicator
            text = `${count} captures`;
            tooltip = `CodeDraft: ${count} captures ready!\nClick to generate draft`;
        }

        // Add session info to tooltip
        if (this.capturesThisSession > 0) {
            const sessionInfo = sessionHours > 0 ?
                `${sessionHours}h ${sessionMinutes}m` :
                `${sessionMinutes}m`;
            tooltip += `\n\nThis session: ${this.capturesThisSession} captures in ${sessionInfo}`;
        }

        // Check for weekly streak
        const weeklyCaptures = await this.captureService.getAllCaptures({ days: 7 });
        if (weeklyCaptures.length > 0) {
            tooltip += `\n\nThis week: ${weeklyCaptures.length} captures`;
        }

        this.statusBarItem.text = `${icon} ${text}`;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.show();
    }

    /**
     * Reset session tracking (call when extension reactivates)
     */
    public resetSession(): void {
        this.sessionStart = Date.now();
        this.capturesThisSession = 0;
        this.update();
    }

    /**
     * Get session statistics
     */
    public getSessionStats() {
        const sessionDuration = Date.now() - this.sessionStart;
        return {
            capturesThisSession: this.capturesThisSession,
            sessionDuration,
            sessionStartTime: new Date(this.sessionStart)
        };
    }

    public dispose() {
        clearInterval(this.updateInterval);
        this.statusBarItem.dispose();
    }
}

/**
 * Quick Menu Command - Shows a quick pick menu with common actions
 */
export async function showQuickMenu(captureService: CaptureService): Promise<void> {
    const captures = await captureService.getAllCaptures();
    const weeklyCaptures = await captureService.getAllCaptures({ days: 7 });

    const items = [
        {
            label: '$(add) Capture Code',
            description: 'Capture selected code snippet',
            action: 'codedraft.captureSnippet'
        },
        {
            label: '$(note) Add Learning Note',
            description: 'Quick text note',
            action: 'codedraft.addLearning'
        }
    ];

    if (captures.length >= 3) {
        items.push({
            label: '$(wand) Generate Draft',
            description: `From ${captures.length} captures`,
            action: 'codedraft.generateDraft'
        });
    }

    if (weeklyCaptures.length > 0) {
        items.push({
            label: '$(calendar) Weekly Review',
            description: `${weeklyCaptures.length} this week`,
            action: 'codedraft.weeklyReview'
        });
    }

    items.push({
        label: '$(list-unordered) View All Captures',
        description: `${captures.length} total`,
        action: 'workbench.view.extension.codedraft'
    });

    items.push({
        label: '$(gear) Settings',
        description: 'Configure CodeDraft',
        action: 'workbench.action.openSettings@codedraft'
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'CodeDraft Quick Menu'
    });

    if (selected) {
        await vscode.commands.executeCommand(selected.action);
    }
}