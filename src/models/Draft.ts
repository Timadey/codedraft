export type DraftStatus = 'draft' | 'ready' | 'published';

export interface DraftMetadata {
    wordCount: number;
    estimatedReadTime: number;
    tags: string[];
}

export interface AIMetadata {
    model: string;
    prompt: string;
    generatedAt: number;
}

export interface Draft {
    id: string;
    title: string;
    content: string;
    status: DraftStatus;
    createdAt: number;
    updatedAt: number;
    sourceCaptures: string[];
    metadata: DraftMetadata;
    aiMetadata?: AIMetadata;
}

export function createDraft(
    title: string,
    content: string,
    sourceCaptures: string[],
    aiMetadata?: AIMetadata
): Draft {
    const wordCount = content.split(/\s+/).length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // 200 WPM average

    return {
        id: `draft-${Date.now()}`,
        title,
        content,
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceCaptures,
        metadata: {
            wordCount,
            estimatedReadTime,
            tags: []
        },
        aiMetadata
    };
}

export function draftToMarkdown(draft: Draft): string {
    return `---
        id: ${draft.id}
        title: ${draft.title}
        status: ${draft.status}
        created: ${new Date(draft.createdAt).toISOString()}
        updated: ${new Date(draft.updatedAt).toISOString()}
        tags: [${draft.metadata.tags.join(', ')}]
        sourceCaptures: [${draft.sourceCaptures.join(', ')}]
        ${draft.aiMetadata ? `aiGenerated: true\naiModel: ${draft.aiMetadata.model}` : ''}
        ---

        ${draft.content}
        `;
}