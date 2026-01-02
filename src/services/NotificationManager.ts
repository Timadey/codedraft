import * as vscode from 'vscode';

interface NotificationStats {
    captureAccepted: number;
    captureDismissed: number;
    captureNeverAgain: number;
    draftAccepted: number;
    draftDismissed: number;
    lastShownByType: Map<string, number>;
    patternSuccess: Map<string, { shown: number; accepted: number }>;
}

export class NotificationManager {
    private lastNotificationTime: number = 0;
    private stats: NotificationStats;
    private sessionStart: number = Date.now();
    private notificationsThisSession = 0;
    private readonly MAX_NOTIFICATIONS_PER_SESSION = 5;

    constructor() {
        this.stats = {
            captureAccepted: 0,
            captureDismissed: 0,
            captureNeverAgain: 0,
            draftAccepted: 0,
            draftDismissed: 0,
            lastShownByType: new Map(),
            patternSuccess: new Map()
        };

        // Load stats from workspace state
        this.loadStats();
    }

    /**
     * Load historical stats for adaptive learning
     */
    private async loadStats(): Promise<void> {
        const context = (global as any).codedraftContext as vscode.ExtensionContext;
        if (context) {
            const saved = context.globalState.get<any>('notificationStats');
            if (saved) {
                this.stats.captureAccepted = saved.captureAccepted || 0;
                this.stats.captureDismissed = saved.captureDismissed || 0;
                this.stats.captureNeverAgain = saved.captureNeverAgain || 0;
                this.stats.draftAccepted = saved.draftAccepted || 0;
                this.stats.draftDismissed = saved.draftDismissed || 0;

                if (saved.patternSuccess) {
                    this.stats.patternSuccess = new Map(Object.entries(saved.patternSuccess));
                }
            }
        }
    }

    /**
     * Save stats for future learning
     */
    private async saveStats(): Promise<void> {
        const context = (global as any).codedraftContext as vscode.ExtensionContext;
        if (context) {
            await context.globalState.update('notificationStats', {
                captureAccepted: this.stats.captureAccepted,
                captureDismissed: this.stats.captureDismissed,
                captureNeverAgain: this.stats.captureNeverAgain,
                draftAccepted: this.stats.draftAccepted,
                draftDismissed: this.stats.draftDismissed,
                patternSuccess: Object.fromEntries(this.stats.patternSuccess)
            });
        }
    }

    /**
     * Calculate acceptance rate for adaptive behavior
     */
    public getAcceptanceRate(): number {
        const total = this.stats.captureAccepted + this.stats.captureDismissed;
        if (total === 0) return 0.5; // Default 50% if no history
        return this.stats.captureAccepted / total;
    }

    /**
     * Get pattern success rate for smart suggestions
     */
    public getPatternSuccessRate(pattern: string): number {
        const stats = this.stats.patternSuccess.get(pattern);
        if (!stats || stats.shown === 0) return 0.5; // Default
        return stats.accepted / stats.shown;
    }

    /**
     * Smart cooldown based on user behavior
     */
    public canShowNotification(type: string = 'general', customCooldown?: number): boolean {
        // Check session limits
        if (this.notificationsThisSession >= this.MAX_NOTIFICATIONS_PER_SESSION) {
            return false;
        }

        const now = Date.now();

        // Get base cooldown from config
        const baseCooldown = vscode.workspace.getConfiguration('codedraft')
            .get<number>('proactive.notificationCooldown') || 30;

        // Adaptive cooldown based on acceptance rate
        const acceptanceRate = this.getAcceptanceRate();
        let adaptiveCooldown = baseCooldown;

        if (acceptanceRate < 0.3) {
            // User dismisses often - increase cooldown
            adaptiveCooldown = baseCooldown * 2;
        } else if (acceptanceRate > 0.7) {
            // User accepts often - decrease cooldown
            adaptiveCooldown = baseCooldown * 0.5;
        }

        const cooldownMs = adaptiveCooldown * 60 * 1000;

        // Check general cooldown
        if ((now - this.lastNotificationTime) < cooldownMs) {
            return false;
        }

        // Check type-specific cooldown
        const lastShownType = this.stats.lastShownByType.get(type);
        if (lastShownType && (now - lastShownType) < cooldownMs) {
            return false;
        }

        // Check if user is actively coding (avoid interrupting deep work)
        if (this.isInDeepWork()) {
            return false;
        }

        return true;
    }

    /**
     * Detect if user is in deep work mode
     */
    private isInDeepWork(): boolean {
        // Heuristic: if less than 2 minutes since last keystroke, user is focused
        const timeSinceLastEdit = Date.now() - this.lastNotificationTime;
        return timeSinceLastEdit < 2 * 60 * 1000;
    }

    /**
     * Show smart capture suggestion with context
     */
    public async showCaptureSuggestion(
        reason: string,
        onAccept: () => Promise<void>,
        options: {
            patterns?: string[];
            score?: number;
            autoSelectRegion?: vscode.Range;
        } = {}
    ): Promise<void> {
        const type = 'capture';
        if (!this.canShowNotification(type)) return;

        // Track pattern for learning
        if (options.patterns) {
            for (const pattern of options.patterns) {
                const stats = this.stats.patternSuccess.get(pattern) || { shown: 0, accepted: 0 };
                stats.shown++;
                this.stats.patternSuccess.set(pattern, stats);
            }
        }

        this.lastNotificationTime = Date.now();
        this.stats.lastShownByType.set(type, Date.now());
        this.notificationsThisSession++;

        // Smart message based on score
        let message = `💡 ${reason}`;
        if (options.score && options.score >= 85) {
            message = `⭐ ${reason}`;
        }

        const actions = ['Capture Now', 'Not Now'];

        // Only show "Don't Ask Again" if user has dismissed multiple times
        if (this.stats.captureDismissed >= 3) {
            actions.push('Remind Less Often');
        }

        const item = await vscode.window.showInformationMessage(
            message,
            ...actions
        );

        if (item === 'Capture Now') {
            this.stats.captureAccepted++;

            // Update pattern success
            if (options.patterns) {
                for (const pattern of options.patterns) {
                    const stats = this.stats.patternSuccess.get(pattern)!;
                    stats.accepted++;
                }
            }

            // Auto-select region if provided
            if (options.autoSelectRegion && vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.selection = new vscode.Selection(
                    options.autoSelectRegion.start,
                    options.autoSelectRegion.end
                );
                vscode.window.activeTextEditor.revealRange(
                    options.autoSelectRegion,
                    vscode.TextEditorRevealType.InCenter
                );
            }

            await onAccept();
        } else if (item === 'Not Now') {
            this.stats.captureDismissed++;
        } else if (item === 'Remind Less Often') {
            // Double the cooldown time
            const currentCooldown = vscode.workspace.getConfiguration('codedraft')
                .get<number>('proactive.notificationCooldown') || 30;
            await vscode.workspace.getConfiguration('codedraft')
                .update('proactive.notificationCooldown', currentCooldown * 2, true);
            vscode.window.showInformationMessage('Will remind you less frequently');
        }

        await this.saveStats();
    }

    /**
     * Show draft generation suggestion
     */
    public async showDraftSuggestion(
        count: number,
        onAccept: () => Promise<void>,
        options: {
            quality?: 'low' | 'medium' | 'high';
            themes?: string[];
        } = {}
    ): Promise<void> {
        const type = 'draft';
        // // Use 24-hour cooldown for draft suggestions to avoid annoyance
        // const cooldown24h = 24 * 60 * 60 * 1000;
        // if (!this.canShowNotification(type, cooldown24h)) return;
        if (!this.canShowNotification(type)) return;

        this.lastNotificationTime = Date.now();
        this.stats.lastShownByType.set(type, Date.now());
        this.notificationsThisSession++;

        let message = `✍️ You have ${count} captures ready`;

        if (options.quality === 'high') {
            message += ' with rich context';
        }

        if (options.themes && options.themes.length > 0) {
            message += `. Detected themes: ${options.themes.slice(0, 2).join(', ')}`;
        }

        const item = await vscode.window.showInformationMessage(
            `${message}. Generate a draft?`,
            'Generate Now',
            'Later',
            'View Captures'
        );

        if (item === 'Generate Now') {
            this.stats.draftAccepted++;
            await onAccept();
        } else if (item === 'Later') {
            this.stats.draftDismissed++;
        } else if (item === 'View Captures') {
            await vscode.commands.executeCommand('workbench.view.extension.codedraft');
        }

        await this.saveStats();
    }

    /**
     * Show weekly review reminder (always shown, bypasses cooldown)
     */
    public async showWeeklyReviewReminder(count: number, highlights?: string[]): Promise<void> {
        let message = `📚 Weekly Review: You captured ${count} learnings this week`;

        if (highlights && highlights.length > 0) {
            message += `\n\nHighlights:\n${highlights.map(h => `• ${h}`).join('\n')}`;
        }

        const item = await vscode.window.showInformationMessage(
            message,
            'Review Now',
            'Generate Draft',
            'Remind Tomorrow'
        );

        if (item === 'Review Now') {
            await vscode.commands.executeCommand('codedraft.weeklyReview');
        } else if (item === 'Generate Draft') {
            await vscode.commands.executeCommand('codedraft.generateDraft');
        }
    }

    /**
     * Show contextual tip based on user behavior
     */
    public async showContextualTip(tip: string, action?: { label: string; command: string }): Promise<void> {
        if (!this.canShowNotification('tip')) return;

        const actions = action ? [action.label, 'Got it'] : ['Got it'];

        const item = await vscode.window.showInformationMessage(
            `💡 Tip: ${tip}`,
            ...actions
        );

        if (item === action?.label && action) {
            await vscode.commands.executeCommand(action.command);
        }

        this.stats.lastShownByType.set('tip', Date.now());
    }

    /**
     * Show milestone celebration
     */
    public async showMilestone(milestone: string, achievement: string): Promise<void> {
        await vscode.window.showInformationMessage(
            `🎉 ${milestone}! ${achievement}`,
            'Awesome!'
        );
    }

    /**
     * Show streak notification
     */
    public async showStreak(days: number): Promise<void> {
        if (days % 7 === 0) { // Weekly milestones
            await vscode.window.showInformationMessage(
                `🔥 ${days} day coding streak! Keep capturing your learnings!`,
                'View Stats'
            ).then(item => {
                if (item === 'View Stats') {
                    vscode.commands.executeCommand('codedraft.weeklyReview');
                }
            });
        }
    }

    /**
     * Reset session counter (call when user takes a break)
     */
    public resetSession(): void {
        this.sessionStart = Date.now();
        this.notificationsThisSession = 0;
    }

    /**
     * Get statistics for dashboard
     */
    public getStats() {
        return {
            ...this.stats,
            acceptanceRate: this.getAcceptanceRate(),
            notificationsThisSession: this.notificationsThisSession
        };
    }
}