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
    private sessionCaptures = 0;
    private lastSaveTime = new Map<string, number>();
    private saveBursts = new Map<string, number>();

    constructor(
        private captureService: CaptureService,
        private draftService: DraftService,
        private gitService: GitService
    ) {
        this.analyzer = new ChangeAnalyzer();
        this.notificationManager = new NotificationManager();
        
        // Store context globally for notification manager
        (global as any).codedraftContext = (global as any).codedraftContext || {};
    }

    public async start() {
        this.isEnabled = vscode.workspace.getConfiguration('codedraft')
            .get<boolean>('proactive.enabled', true);

        if (!this.isEnabled) {
            console.log('CodeDraft: Proactive monitoring disabled');
            return;
        }

        console.log('CodeDraft: Starting intelligent proactive monitoring...');

        // Watch for file saves
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(this.handleFileSave.bind(this))
        );

        // Watch for text changes (for burst detection)
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(this.handleTextChange.bind(this))
        );

        // Watch for git commits
        this.disposables.push(
            this.gitService.onDidCommit(this.handleCommit.bind(this))
        );

        // Watch for active editor changes (to detect context switches)
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.handleEditorChange.bind(this))
        );

        // Setup time-based checks (hourly)
        const timer = setInterval(() => this.checkTimeBasedTriggers(), 60 * 60 * 1000);
        this.disposables.push({ dispose: () => clearInterval(timer) });

        // Cleanup analyzer state daily
        const cleanupTimer = setInterval(() => this.analyzer.cleanup(), 24 * 60 * 60 * 1000);
        this.disposables.push({ dispose: () => clearInterval(cleanupTimer) });

        // Listen for captures to track session
        this.disposables.push(
            this.captureService.onDidCapture(() => {
                this.sessionCaptures++;
                this.checkMilestones();
            })
        );
    }

    public stop() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    /**
     * Enhanced file save handler with burst detection and smart analysis
     */
    private async handleFileSave(document: vscode.TextDocument) {
        if (!this.isEnabled) return;

        // Ignore non-source files
        if (this.shouldIgnoreFile(document.fileName)) return;

        const now = Date.now();
        const fileName = document.fileName;

        // Track save bursts (rapid successive saves = user is iterating)
        const lastSave = this.lastSaveTime.get(fileName) || 0;
        const timeSinceLastSave = now - lastSave;
        
        if (timeSinceLastSave < 5000) { // Within 5 seconds
            const burstCount = (this.saveBursts.get(fileName) || 0) + 1;
            this.saveBursts.set(fileName, burstCount);
            
            // Don't interrupt rapid iteration
            if (burstCount > 2) {
                return;
            }
        } else {
            this.saveBursts.set(fileName, 0);
        }

        this.lastSaveTime.set(fileName, now);

        // Analyze the entire document for interesting patterns
        const analysis = await this.analyzer.analyzeChange(document, []);

        if (analysis.isInteresting && analysis.score >= 70) {
            await this.notificationManager.showCaptureSuggestion(
                analysis.reason || 'Interesting change detected',
                async () => {
                    await vscode.commands.executeCommand('codedraft.captureSnippet');
                },
                {
                    patterns: analysis.patterns,
                    score: analysis.score,
                    autoSelectRegion: analysis.suggestedCapture?.selection
                }
            );
        }
    }

    /**
     * Track text changes for burst detection
     */
    private handleTextChange(event: vscode.TextDocumentChangeEvent) {
        // Just track that user is actively editing
        // This helps NotificationManager avoid interrupting deep work
    }

    /**
     * Enhanced editor change handler for context switch detection
     */
    private async handleEditorChange(editor: vscode.TextEditor | undefined) {
        if (!editor || !this.isEnabled) return;

        // Check if user is switching between many files (exploration mode)
        // Could suggest capturing learnings after exploring
    }

    /**
     * Enhanced commit handler with pattern-based suggestions
     */
    private async handleCommit(commit: GitCommitInfo) {
        if (!this.isEnabled) return;

        // Analyze commit message
        const message = commit.message.toLowerCase();
        const significantKeywords = [
            { keyword: 'fix', type: 'bug-fix', priority: 85 },
            { keyword: 'refactor', type: 'refactor', priority: 75 },
            { keyword: 'feat', type: 'feature', priority: 80 },
            { keyword: 'optimize', type: 'performance', priority: 85 },
            { keyword: 'security', type: 'security', priority: 90 },
            { keyword: 'breaking', type: 'breaking-change', priority: 95 },
            { keyword: 'add', type: 'feature', priority: 70 },
            { keyword: 'update', type: 'update', priority: 65 }
        ];

        let matchedKeyword = significantKeywords.find(k => message.includes(k.keyword));
        
        if (matchedKeyword) {
            const customMessage = this.getCommitCaptureMessage(matchedKeyword.type, commit.message);
            
            await this.notificationManager.showCaptureSuggestion(
                customMessage,
                async () => {
                    await vscode.commands.executeCommand('codedraft.captureSnippet', { 
                        commitHash: commit.hash 
                    });
                },
                {
                    patterns: [matchedKeyword.type],
                    score: matchedKeyword.priority
                }
            );
        }
    }

    /**
     * Get contextual message for commit capture
     */
    private getCommitCaptureMessage(type: string, message: string): string {
        const messages: Record<string, string> = {
            'bug-fix': `🐛 Bug fix committed: "${message.substring(0, 50)}..."`,
            'refactor': `♻️ Refactor committed: "${message.substring(0, 50)}..."`,
            'feature': `✨ New feature: "${message.substring(0, 50)}..."`,
            'performance': `⚡ Performance improvement: "${message.substring(0, 50)}..."`,
            'security': `🔒 Security update: "${message.substring(0, 50)}..."`,
            'breaking-change': `💥 Breaking change: "${message.substring(0, 50)}..."`,
            'update': `📝 Update committed: "${message.substring(0, 50)}..."`
        };

        return messages[type] || `Significant commit: "${message.substring(0, 50)}..."`;
    }

    /**
     * Enhanced time-based checks with theme detection
     */
    private async checkTimeBasedTriggers() {
        const config = vscode.workspace.getConfiguration('codedraft');
        const now = new Date();

        // Weekly Review with smart timing
        const reviewDay = config.get<string>('proactive.weeklyReviewDay', 'Friday');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        if (days[now.getDay()] === reviewDay && now.getHours() >= 17 && now.getHours() < 18) {
            const captures = await this.captureService.getAllCaptures({ days: 7 });
            if (captures.length >= 3) {
                // Detect themes in captures
                const themes = this.detectThemes(captures);
                const highlights = captures
                    .slice(0, 3)
                    .map(c => c.notes || c.content.substring(0, 60));

                await this.notificationManager.showWeeklyReviewReminder(
                    captures.length,
                    highlights
                );
            }
        }

        // Smart draft suggestion based on quality
        const allCaptures = await this.captureService.getAllCaptures();
        if (allCaptures.length >= 5) {
            const quality = this.assessCaptureQuality(allCaptures);
            const themes = this.detectThemes(allCaptures);

            if (quality !== 'low' || allCaptures.length >= 8) {
                await this.notificationManager.showDraftSuggestion(
                    allCaptures.length,
                    async () => {
                        await vscode.commands.executeCommand('codedraft.generateDraft');
                    },
                    { quality, themes }
                );
            }
        }

        // Session tips based on behavior
        await this.showContextualTips();
    }

    /**
     * Detect common themes in captures
     */
    private detectThemes(captures: any[]): string[] {
        const themes: Map<string, number> = new Map();

        captures.forEach(capture => {
            // Check code language
            if (capture.code?.language) {
                themes.set(capture.code.language, (themes.get(capture.code.language) || 0) + 1);
            }

            // Check context patterns
            if (capture.context?.framework) {
                themes.set(capture.context.framework, (themes.get(capture.context.framework) || 0) + 1);
            }

            // Check for common terms in notes
            const notes = (capture.notes || '').toLowerCase();
            const keywords = ['performance', 'bug', 'refactor', 'api', 'security', 'test'];
            keywords.forEach(keyword => {
                if (notes.includes(keyword)) {
                    themes.set(keyword, (themes.get(keyword) || 0) + 1);
                }
            });
        });

        // Return top 3 themes
        return Array.from(themes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([theme]) => theme);
    }

    /**
     * Assess quality of captures for draft generation
     */
    private assessCaptureQuality(captures: any[]): 'low' | 'medium' | 'high' {
        let score = 0;

        captures.forEach(capture => {
            // Has detailed notes
            if (capture.notes && capture.notes.length > 50) score += 2;
            else if (capture.notes) score += 1;

            // Has rich context
            if (capture.context?.functionName || capture.context?.className) score += 2;
            if (capture.context?.framework) score += 1;
            if (capture.context?.surroundingCode) score += 2;

            // Has code
            if (capture.code) score += 1;
        });

        const avgScore = score / captures.length;

        if (avgScore >= 5) return 'high';
        if (avgScore >= 3) return 'medium';
        return 'low';
    }

    /**
     * Show contextual tips based on user behavior
     */
    private async showContextualTips() {
        const captures = await this.captureService.getAllCaptures();
        
        // Tip: Add more context if captures lack it
        const lowContextCaptures = captures.filter(c => 
            !c.context || (!c.context.functionName && !c.context.surroundingCode)
        );

        if (lowContextCaptures.length > 3 && captures.length < 10) {
            await this.notificationManager.showContextualTip(
                'Add more context to your captures for better AI-generated drafts',
                { label: 'Learn How', command: 'vscode.open' }
            );
        }

        // Tip: Suggest weekly review habit
        if (this.sessionCaptures >= 5 && this.sessionCaptures % 5 === 0) {
            await this.notificationManager.showContextualTip(
                'Great progress! Consider doing a weekly review on Fridays',
                { label: 'Set Reminder', command: 'workbench.action.openSettings@codedraft.proactive' }
            );
        }
    }

    /**
     * Check for milestones and celebrate
     */
    private async checkMilestones() {
        const milestones = [5, 10, 25, 50, 100];
        if (milestones.includes(this.sessionCaptures)) {
            const achievements = {
                5: 'Ready for your first draft!',
                10: 'Building a great habit!',
                25: 'Quarter century! Keep going!',
                50: 'Half-century milestone!',
                100: 'Century! You\'re a documentation master!'
            };

            await this.notificationManager.showMilestone(
                `${this.sessionCaptures} Captures`,
                achievements[this.sessionCaptures as keyof typeof achievements]
            );
        }
    }

    /**
     * Check if file should be ignored
     */
    private shouldIgnoreFile(fileName: string): boolean {
        const ignorePatterns = [
            '.git',
            'node_modules',
            '.vscode',
            'dist',
            'build',
            'out',
            '.next',
            'coverage',
            '__pycache__'
        ];

        return ignorePatterns.some(pattern => fileName.includes(pattern)) ||
            fileName.endsWith('.min.js') ||
            fileName.endsWith('.map') ||
            fileName.endsWith('.lock');
    }
}