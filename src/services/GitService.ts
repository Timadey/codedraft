import * as vscode from 'vscode';

export interface GitCommitInfo {
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface GitDiffInfo {
    diff: string;
    affectedFiles: string[];
}

export class GitService {
    private gitApi: any;


    private lastHead: string | undefined;
    private _onDidCommit = new vscode.EventEmitter<GitCommitInfo>();
    public readonly onDidCommit = this._onDidCommit.event;

    constructor() {
        this.initializeApi();
    }

    private initializeApi() {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            const api = gitExtension.exports.getAPI(1);
            this.gitApi = api;

            if (this.gitApi.repositories.length > 0) {
                this.setupRepoListener(this.gitApi.repositories[0]);
            } else {
                this.gitApi.onDidChangeState((state: any) => {
                    if (state === 'initialized' && this.gitApi.repositories.length > 0) {
                        this.setupRepoListener(this.gitApi.repositories[0]);
                    }
                });
            }
        }
    }

    private setupRepoListener(repo: any) {
        // Initialize last head
        this.lastHead = repo.state.HEAD?.commit;

        // Listen for changes
        repo.state.onDidChange(async () => {
            const currentHead = repo.state.HEAD?.commit;
            if (currentHead && this.lastHead && currentHead !== this.lastHead) {
                this.lastHead = currentHead;
                const commitInfo = await this.getLatestCommit();
                if (commitInfo) {
                    this._onDidCommit.fire(commitInfo);
                }
            } else if (!this.lastHead && currentHead) {
                this.lastHead = currentHead;
            }
        });
    }

    private getRepository() {
        if (!this.gitApi || !this.gitApi.repositories || this.gitApi.repositories.length === 0) {
            return null;
        }
        // Use the first repository or the one containing the active file
        if (vscode.window.activeTextEditor) {
            const uri = vscode.window.activeTextEditor.document.uri;
            const repo = this.gitApi.getRepository(uri);
            if (repo) return repo;
        }
        return this.gitApi.repositories[0];
    }

    /**
     * Get the latest commit for the current workspace
     */
    async getLatestCommit(): Promise<GitCommitInfo | null> {
        const repo = this.getRepository();
        if (!repo) return null;

        try {
            const commits = await repo.log({ maxEntries: 1 });
            if (commits && commits.length > 0) {
                const commit = commits[0];
                return {
                    hash: commit.hash,
                    message: commit.message,
                    author: commit.authorName || 'unknown',
                    date: commit.authorDate || new Date()
                };
            }
        } catch (error) {
            console.error('Git error (latest commit):', error);
        }
        return null;
    }

    /**
     * Get the diff for the current uncommitted changes (staged + unstaged)
     */
    async getCurrentChanges(): Promise<GitDiffInfo | null> {
        const repo = this.getRepository();
        if (!repo) return null;

        try {
            // Get diffs for working tree and index
            const workingTreeDiff = await repo.diff(false);
            const indexDiff = await repo.diff(true);

            const fullDiff = (indexDiff || '') + (workingTreeDiff || '');
            if (!fullDiff) return null;

            // Extract affected files (heuristic)
            const affectedFiles = new Set<string>();
            const fileLines = fullDiff.split('\n').filter((l: string) => l.startsWith('diff --git'));
            fileLines.forEach((line: string) => {
                const match = line.match(/b\/(.+)$/);
                if (match) affectedFiles.add(match[1]);
            });

            return {
                diff: fullDiff,
                affectedFiles: Array.from(affectedFiles)
            };
        } catch (error) {
            console.error('Git error (current changes):', error);
        }
        return null;
    }

    /**
     * Get the diff of a specific commit
     */
    async getCommitDiff(hash: string): Promise<string | null> {
        const repo = this.getRepository();
        if (!repo) return null;

        try {
            return await this.runGitCommand(['show', hash], repo.rootUri.fsPath);
        } catch (error) {
            console.error(`Git error (commit diff ${hash}):`, error);
        }
        return null;
    }

    /**
     * Get files changed in the last X days
     */
    async getRecentChanges(days: number): Promise<string[]> {
        const repo = this.getRepository();
        if (!repo) return [];

        try {
            const result = await this.runGitCommand(
                ['log', `--since=${days}.days`, '--name-only', '--pretty=format:'],
                repo.rootUri.fsPath
            );

            if (!result) return [];

            return Array.from(new Set(result.split('\n').map(f => f.trim()).filter(f => f)));
        } catch (error) {
            console.error('Git error (recent changes):', error);
        }
        return [];
    }

    /**
     * Helper to run git commands directly
     */
    private runGitCommand(args: string[], cwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const command = `git ${args.join(' ')}`;

            exec(command, { cwd }, (error: any, stdout: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }
}
