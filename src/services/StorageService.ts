import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import {CaptureItem} from '../models/CaptureItem';
import {Draft, draftToMarkdown} from '../models/Draft';

export class StorageService {
    private readonly workspacePath: string;
    private readonly codedraftDir: string;
    private readonly capturesDir: string;
    private readonly draftsDir: string;

    constructor() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        this.workspacePath = workspaceFolder.uri.fsPath;
        this.codedraftDir = path.join(this.workspacePath, '.codedraft');
        this.capturesDir = path.join(this.codedraftDir, 'captures');
        this.draftsDir = path.join(this.codedraftDir, 'drafts');

    }

    async initialize(): Promise<void> {
        await this.ensureDirectory(this.codedraftDir);
        await this.ensureDirectory(this.capturesDir);
        await this.ensureDirectory(this.draftsDir);

        // Create .gitignore
        const gitignorePath = path.join(this.codedraftDir, '.gitignore');
        const gitignoreContent = `# CodeDraft local data\ncaptures/\n*.json\ndrafts\n`;
        try {
            await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');
        } catch (e) {
            // Ignore if already exists
        }
    }

    // Capture operations
    async saveCapture(capture: CaptureItem): Promise<void> {
        const captures = await this.loadCaptures();
        captures.push(capture);
        await this.saveCaptures(captures);
    }

    async loadCaptures(): Promise<CaptureItem[]> {
        const capturesFile = path.join(this.capturesDir, 'captures.json');
        try {
            const data = await fs.readFile(capturesFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    private async saveCaptures(captures: CaptureItem[]): Promise<void> {
        const capturesFile = path.join(this.capturesDir, 'captures.json');
        await fs.writeFile(capturesFile, JSON.stringify(captures, null, 2), 'utf8');
    }

    async deleteCapture(id: string): Promise<void> {
        const captures = await this.loadCaptures();
        const filtered = captures.filter(c => c.id !== id);
        await this.saveCaptures(filtered);
    }

    async updateCapture(id: string, updates: Partial<CaptureItem>): Promise<void> {
        const captures = await this.loadCaptures();
        const index = captures.findIndex(c => c.id === id);
        if (index !== -1) {
            captures[index] = { ...captures[index], ...updates };
            await this.saveCaptures(captures);
        }
    }

    // Draft operations
    async saveDraft(draft: Draft): Promise<void> {
        const filename = `${draft.id}.md`;
        const filepath = path.join(this.draftsDir, filename);
        const markdown = draftToMarkdown(draft);
        await fs.writeFile(filepath, markdown, 'utf8');
    }

    async loadDrafts(): Promise<Draft[]> {
        try {
            const files = await fs.readdir(this.draftsDir);
            const draftFiles = files.filter(f => f.endsWith('.md'));

            const drafts = await Promise.all(
                draftFiles.map(async (file) => {
                    const filepath = path.join(this.draftsDir, file);
                    const content = await fs.readFile(filepath, 'utf8');
                    return this.parseDraftFromMarkdown(content);
                })
            );

            return drafts.filter(d => d !== null) as Draft[];
        } catch {
            return [];
        }
    }

    async loadDraft(id: string): Promise<Draft | null> {
        const filepath = path.join(this.draftsDir, `${id}.md`);
        try {
            const content = await fs.readFile(filepath, 'utf8');
            return this.parseDraftFromMarkdown(content);
        } catch {
            return null;
        }
    }

    async deleteDraft(id: string): Promise<void> {
        const filepath = path.join(this.draftsDir, `${id}.md`);
        await fs.unlink(filepath);
    }

    private parseDraftFromMarkdown(markdown: string): Draft | null {
        const match = markdown.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
        if (!match) return null;

        const [, frontmatter, content] = match;
        const metadata: any = {};

        frontmatter.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                metadata[key] = line.substring(colonIndex + 1).trim();
            }
        });

        return {
            id: metadata.id,
            title: metadata.title,
            content: content.trim(),
            status: metadata.status as any,
            createdAt: new Date(metadata.created).getTime(),
            updatedAt: new Date(metadata.updated).getTime(),
            sourceCaptures: [],
            metadata: {
                wordCount: content.split(/\s+/).length,
                estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200),
                tags: []
            }
        };
    }

    private async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }
}