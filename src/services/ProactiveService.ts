import * as vscode from 'vscode';
import { CaptureService } from './CaptureService';
import { DraftService } from './DraftService';
import { GitService, GitCommitInfo } from './GitService';
import { ChangeAnalyzer } from './ChangeAnalyzer';
import { NotificationManager } from './NotificationManager';

export class ProactiveService {
    private analyzer: ChangeAnalyzer;
    private notificationManager: NotificationManager;
    private disposables: vscode.Disposable[] = [];
    private isEnabled: boolean = true;

    constructor(
        private captureService: CaptureService,
        private draftService: DraftService,
        private gitService: GitService
    ) {
        this.analyzer = new ChangeAnalyzer();
        this.notificationManager = new NotificationManager();
    }

    public async start() {
        this.isEnabled = vscode.workspace.getConfiguration('codedraft').get<boolean>('proactive.enabled', true);

        if (!this.isEnabled) return;

        console.log('CodeDraft: Starting proactive monitoring...');

        // Watch for file saves
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this))
        );

        // Watch for git commits
        this.disposables.push(
            this.gitService.onDidCommit(this.handleCommit.bind(this))
        );

        // Setup time-based checks (every hour)
        const timer = setInterval(() => this.checkTimeBasedTriggers(), 60 * 60 * 1000);
        this.disposables.push({ dispose: () => clearInterval(timer) });
    }

    public stop() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    private async handleFileSave(document: vscode.TextDocument) {
        if (!this.isEnabled) return;

        // Ignore non-source files
        if (document.fileName.includes('.git') || document.fileName.includes('node_modules')) return;

        const analysis = await this.analyzer.analyzeChange(document, []);

        if (analysis.isInteresting) {
            await this.notificationManager.showCaptureSuggestion(
                analysis.reason || 'Interesting change detected',
                async () => {
                    await vscode.commands.executeCommand('codedraft.captureSnippet');
                }
            );
        }
    }

    private async handleCommit(commit: GitCommitInfo) {
        if (!this.isEnabled) return;

        // Analyze commit message keywords
        const significantKeywords = ['fix', 'refactor', 'feat', 'optimize', 'revert', 'update', 'add'];
        const isInteresting = significantKeywords.some(keyword =>
            commit.message.toLowerCase().includes(keyword)
        );

        if (isInteresting) {
            await this.notificationManager.showCaptureSuggestion(
                `Significant commit detected: "${commit.message}"`,
                async () => {
                    await this.captureService.captureCodeSnippet(vscode.window.activeTextEditor);
                }
            );
        }
    }

    private async checkTimeBasedTriggers() {
        const config = vscode.workspace.getConfiguration('codedraft');
        const now = new Date();

        // Weekly Review
        const reviewDay = config.get<string>('proactive.weeklyReviewDay', 'Friday');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        if (days[now.getDay()] === reviewDay && now.getHours() >= 17 && now.getHours() < 18) {
            const captures = await this.captureService.getAllCaptures({ days: 7 });
            if (captures.length > 0) {
                await this.notificationManager.showWeeklyReviewReminder(captures.length);
            }
        }

        // Draft Suggestion
        const unsortedCaptures = await this.captureService.getAllCaptures();
        if (unsortedCaptures.length >= 5) {
            await this.notificationManager.showDraftSuggestion(
                unsortedCaptures.length,
                async () => {
                    await vscode.commands.executeCommand('codedraft.generateDraft');
                }
            );
        }
    }
}
