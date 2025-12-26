import * as vscode from 'vscode';

export type CaptureType = 'snippet' | 'commit' | 'note' | 'learning';

export interface CodeSnippet {
    snippet: string;
    language: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
}

// Rich context for better AI generation
export interface CaptureContext {
    // File context
    filePath: string;
    fileName: string;
    language: string;

    // Code context
    surroundingCode?: string; // Lines before/after the snippet
    functionName?: string;
    className?: string;

    // Git context
    commitHash?: string;
    commitMessage?: string;
    diffSummary?: string;
    affectedFiles?: string[];

    // Project context
    projectDeps?: string[]; // From package.json
    framework?: string; // React, Vue, etc.
    projectDescription?: string; // From README

    // Additional metadata
    relatedCaptures?: string[]; // IDs of related captures
}

export interface CaptureMetadata {
    project: string;
    branch?: string;
    capturedAt: string; // Human-readable date
}

export interface CaptureItem {
    id: string;
    timestamp: number;
    type: CaptureType;
    content: string;
    code?: CodeSnippet;
    notes: string;
    tags: string[];
    commitHash?: string;
    metadata: CaptureMetadata;
    context?: CaptureContext; // Rich context for AI
}

export function createCapture(
    type: CaptureType,
    content: string,
    options: Partial<CaptureItem> = {}
): CaptureItem {
    const now = Date.now();
    return {
        id: generateId(),
        timestamp: now,
        type,
        content,
        notes: options.notes || '',
        tags: options.tags || [],
        metadata: {
            project: getWorkspaceName(),
            capturedAt: new Date(now).toLocaleString(),
            ...options.metadata
        },
        ...options
    };
}

function generateId(): string {
    return `cap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getWorkspaceName(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.name || 'untitled';
}