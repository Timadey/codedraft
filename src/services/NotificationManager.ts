import * as vscode from 'vscode';

export class NotificationManager {
    private lastNotificationTime: number = 0;
    private readonly COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes default

    // Track user responses to improve suggestions over time
    private stats = {
        captureAccepted: 0,
        captureDismissed: 0,
        draftAccepted: 0,
        draftDismissed: 0
    };

    /**
     * Check if we can show a notification based on rate limiting
     */
    public canShowNotification(): boolean {
        const now = Date.now();
        const cooldown = vscode.workspace.getConfiguration('codedraft').get<number>('proactive.notificationCooldown') || 30;
        const cooldownMs = cooldown * 60 * 1000;

        return (now - this.lastNotificationTime) > cooldownMs;
    }

    /**
     * Show a suggestion to capture code
     */
    public async showCaptureSuggestion(reason: string, onAccept: () => Promise<void>): Promise<void> {
        if (!this.canShowNotification()) return;

        this.lastNotificationTime = Date.now();

        const item = await vscode.window.showInformationMessage(
            `CodeDraft: ${reason}. Capture this learning?`,
            'Capture',
            'Not Now',
            'Don\'t Ask Again'
        );

        if (item === 'Capture') {
            this.stats.captureAccepted++;
            await onAccept();
        } else if (item === 'Not Now') {
            this.stats.captureDismissed++;
        } else if (item === 'Don\'t Ask Again') {
            await vscode.workspace.getConfiguration('codedraft').update('proactive.enabled', false, true);
        }
    }

    /**
     * Show a suggestion to generate a draft
     */
    public async showDraftSuggestion(count: number, onAccept: () => Promise<void>): Promise<void> {
        if (!this.canShowNotification()) return;

        this.lastNotificationTime = Date.now();

        const item = await vscode.window.showInformationMessage(
            `You've captured ${count} learnings. Ready to generate a draft?`,
            'Generate Draft',
            'Later'
        );

        if (item === 'Generate Draft') {
            this.stats.draftAccepted++;
            await onAccept();
        } else {
            this.stats.draftDismissed++;
        }
    }

    /**
     * Show weekly review reminder
     */
    public async showWeeklyReviewReminder(count: number): Promise<void> {
        // Always show weekly review regardless of cooldown
        const item = await vscode.window.showInformationMessage(
            `📚 Weekly Review: You captured ${count} learnings this week.`,
            'Review Now',
            'Remind Tomorrow'
        );

        if (item === 'Review Now') {
            await vscode.commands.executeCommand('codedraft.weeklyReview');
        }
    }
}
