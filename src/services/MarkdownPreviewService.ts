import * as vscode from 'vscode';
import { Draft } from '../models/Draft';

export class MarkdownPreviewService {
    private panels: Map<string, vscode.WebviewPanel> = new Map();

    constructor(private context: vscode.ExtensionContext) { }

    async showPreview(draft: Draft): Promise<void> {
        // Check if panel already exists for this draft
        const existingPanel = this.panels.get(draft.id);
        if (existingPanel) {
            existingPanel.reveal(vscode.ViewColumn.Two);
            return;
        }

        // Create new webview panel
        const panel = vscode.window.createWebviewPanel(
            'codedraftPreview',
            `Preview: ${draft.title}`,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // Store panel reference
        this.panels.set(draft.id, panel);

        // Handle panel disposal
        panel.onDidDispose(() => {
            this.panels.delete(draft.id);
        });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'copy':
                        await vscode.env.clipboard.writeText(draft.content);
                        vscode.window.showInformationMessage('✅ Draft copied to clipboard!');
                        break;
                    case 'copyMarkdown':
                        await vscode.env.clipboard.writeText(draft.content);
                        vscode.window.showInformationMessage('✅ Markdown copied to clipboard!');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Set webview content
        panel.webview.html = this.getWebviewContent(draft);
    }

    private getWebviewContent(draft: Draft): string {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview: ${this.escapeHtml(draft.title)}</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            padding: 0;
            margin: 0;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
        }

        .toolbar {
            position: sticky;
            top: 0;
            background-color: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            backdrop-filter: blur(10px);
        }

        .toolbar-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
            opacity: 0.9;
        }

        .toolbar-actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .content {
            max-width: 900px;
            margin: 0 auto;
            padding: 30px 20px;
        }

        .preview-container {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .markdown-body {
            font-size: 16px;
            line-height: 1.8;
        }

        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3,
        .markdown-body h4,
        .markdown-body h5,
        .markdown-body h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: var(--vscode-editor-foreground);
        }

        .markdown-body h1 {
            font-size: 2em;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.3em;
        }

        .markdown-body h2 {
            font-size: 1.5em;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.3em;
        }

        .markdown-body h3 { font-size: 1.25em; }
        .markdown-body h4 { font-size: 1em; }
        .markdown-body h5 { font-size: 0.875em; }
        .markdown-body h6 { font-size: 0.85em; }

        .markdown-body p {
            margin-top: 0;
            margin-bottom: 16px;
        }

        .markdown-body pre {
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            margin: 16px 0;
            border: 1px solid var(--vscode-panel-border);
        }

        .markdown-body code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.9em;
        }

        .markdown-body pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
        }

        .markdown-body ul,
        .markdown-body ol {
            padding-left: 2em;
            margin-top: 0;
            margin-bottom: 16px;
        }

        .markdown-body li {
            margin-bottom: 8px;
        }

        .markdown-body blockquote {
            margin: 16px 0;
            padding: 0 1em;
            color: var(--vscode-editor-foreground);
            opacity: 0.8;
            border-left: 4px solid var(--vscode-panel-border);
        }

        .markdown-body a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }

        .markdown-body a:hover {
            text-decoration: underline;
        }

        .markdown-body hr {
            height: 1px;
            padding: 0;
            margin: 24px 0;
            background-color: var(--vscode-panel-border);
            border: 0;
        }

        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }

        .markdown-body table th,
        .markdown-body table td {
            padding: 8px 12px;
            border: 1px solid var(--vscode-panel-border);
        }

        .markdown-body table th {
            background-color: var(--vscode-textCodeBlock-background);
            font-weight: 600;
        }

        .metadata {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .metadata-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        @media (max-width: 768px) {
            .preview-container {
                padding: 20px;
            }
            
            .content {
                padding: 20px 10px;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-title">${this.escapeHtml(draft.title)}</div>
        <div class="toolbar-actions">
            <button class="btn btn-secondary" onclick="copyMarkdown()">
                <span>📋</span>
                Copy Markdown
            </button>
        </div>
    </div>

    <div class="content">
        <div class="preview-container">
            <div class="markdown-body" id="markdown-content">
                <!-- Markdown will be rendered here -->
            </div>
            
            <div class="metadata">
                <div class="metadata-item">
                    <span>📝</span>
                    <span>${draft.metadata.wordCount} words</span>
                </div>
                <div class="metadata-item">
                    <span>⏱️</span>
                    <span>${draft.metadata.estimatedReadTime} min read</span>
                </div>
                <div class="metadata-item">
                    <span>📊</span>
                    <span>Status: ${this.escapeHtml(draft.status)}</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const markdownContent = ${JSON.stringify(draft.content)};

        function copyMarkdown() {
            vscode.postMessage({ command: 'copyMarkdown' });
        }

        function renderMarkdown(markdown) {
            let html = markdown;

            // Code blocks first
            html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
            
            // Inline code
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

            // Headers
            html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
            html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

            // Bold
            html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
            html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

            // Italic
            html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
            html = html.replace(/_(.+?)_/g, '<em>$1</em>');

            // Links
            html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');

            // Blockquotes
            html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

            // Horizontal rules
            html = html.replace(/^---$/gim, '<hr>');
            html = html.replace(/^\\*\\*\\*$/gim, '<hr>');

            // Lists
            html = html.replace(/^\\* (.+)$/gim, '<li>$1</li>');
            html = html.replace(/^- (.+)$/gim, '<li>$1</li>');
            html = html.replace(/^\\d+\\. (.+)$/gim, '<li>$1</li>');
            
            // Wrap lists
            html = html.replace(/(<li>.*?<\\/li>(\\n|<br>)?)+/gs, function(match) {
                return '<ul>' + match + '</ul>';
            });

            // Line breaks
            html = html.replace(/\\n\\n/g, '</p><p>');
            html = html.replace(/\\n/g, '<br>');

            // Wrap in paragraphs
            html = '<p>' + html + '</p>';

            // Clean up
            html = html.replace(/<p><\\/p>/g, '');
            html = html.replace(/<p>(<h[1-6]>)/g, '$1');
            html = html.replace(/(<\\/h[1-6]>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<ul>)/g, '$1');
            html = html.replace(/(<\\/ul>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<ol>)/g, '$1');
            html = html.replace(/(<\\/ol>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<pre>)/g, '$1');
            html = html.replace(/(<\\/pre>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<blockquote>)/g, '$1');
            html = html.replace(/(<\\/blockquote>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<hr>)/g, '$1');
            html = html.replace(/(<hr>)<\\/p>/g, '$1');

            return html;
        }

        document.getElementById('markdown-content').innerHTML = renderMarkdown(markdownContent);
    </script>
</body>
</html>`;

        return htmlContent;
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    dispose(): void {
        this.panels.forEach(panel => panel.dispose());
        this.panels.clear();
    }
}
