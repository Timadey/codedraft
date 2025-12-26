import * as vscode from 'vscode';
import { CaptureItem } from '../models/CaptureItem';

// AI Provider interfaces
export interface AIProvider {
    name: string;
    call(prompt: string, options: AICallOptions): Promise<string>;
    isAvailable(): Promise<boolean>;
}

export interface AICallOptions {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

export type DraftStyle = 'technical' | 'conversational' | 'tutorial' | 'deep-dive' | 'quick-tip';

export class AIService {
    private provider: AIProvider | null = null;

    constructor() {
        this.initializeProvider();
    }

    private async initializeProvider() {
        const config = vscode.workspace.getConfiguration('codedraft');
        const providerName = config.get<string>('ai.provider', 'ollama');

        switch (providerName) {
            case 'ollama':
                this.provider = new OllamaProvider();
                break;
            case 'openai':
                this.provider = new OpenAIProvider();
                break;
            case 'anthropic':
                this.provider = new AnthropicProvider();
                break;
            case 'grok':
                this.provider = new GrokProvider();
                break;
            case 'cohere':
                this.provider = new CohereProvider();
                break;
            default:
                this.provider = new SimpleAIProvider(); // Fallback
        }

        // Check availability
        const available = await this.provider.isAvailable();
        if (!available) {
            vscode.window.showWarningMessage(
                `${this.provider.name} is not available. Using simple AI. Configure in settings.`,
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'codedraft.ai');
                }
            });
            this.provider = new SimpleAIProvider();
        }
    }

    /**
     * Generate title suggestions with rich context
     */
    async generateTitle(captures: CaptureItem[], style: DraftStyle = 'technical'): Promise<string[]> {
        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildTitlePrompt(captures, style);
        const systemPrompt = this.getSystemPrompt('title', style);

        try {
            const response = await this.provider!.call(prompt, {
                systemPrompt,
                temperature: 0.8,
                maxTokens: 200
            });

            return this.parseTitles(response);
        } catch (error: any) {
            vscode.window.showErrorMessage(`AI generation failed: ${error.message}`);
            return this.getFallbackTitles(captures);
        }
    }

    /**
     * Generate outline with rich context
     */
    async generateOutline(
        captures: CaptureItem[],
        title: string,
        style: DraftStyle = 'technical'
    ): Promise<string> {
        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildOutlinePrompt(captures, title, style);
        const systemPrompt = this.getSystemPrompt('outline', style);

        return await this.provider!.call(prompt, {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 500
        });
    }

    /**
     * Generate full draft with rich context
     */
    async generateDraft(
        captures: CaptureItem[],
        outline: string,
        title: string,
        style: DraftStyle = 'technical'
    ): Promise<string> {
        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildDraftPrompt(captures, outline, title, style);
        const systemPrompt = this.getSystemPrompt('draft', style);

        return await this.provider!.call(prompt, {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 3000
        });
    }

    /**
     * Build rich title prompt with context
     */
    private buildTitlePrompt(captures: CaptureItem[], style: DraftStyle): string {
        const capturesText = captures.map((c, idx) => {
            let text = `\n## Capture ${idx + 1}\n`;
            text += `**Type:** ${c.type}\n`;
            text += `**Notes:** ${c.notes}\n`;

            if (c.code) {
                text += `**Language:** ${c.code.language}\n`;
                text += `**File:** ${c.code.filePath}\n`;
                text += `\`\`\`${c.code.language}\n${c.code.snippet}\n\`\`\`\n`;
            }

            if (c.context) {
                text += `\n**Context:**\n`;
                if (c.context.functionName) text += `- Function: \`${c.context.functionName}\`\n`;
                if (c.context.className) text += `- Class: \`${c.context.className}\`\n`;
                if (c.context.framework) text += `- Framework: ${c.context.framework}\n`;
                if (c.context.projectDescription) text += `- Project: ${c.context.projectDescription}\n`;
            }

            return text;
        }).join('\n---\n');

        return `Based on these code learnings and their context, suggest 7 compelling blog post titles.

${capturesText}

Requirements:
- ${style === 'conversational' ? 'Friendly and approachable' : 'Professional and technical'}
- SEO-friendly with relevant keywords
- Clear and specific about the content
- 50-70 characters each
- Audience: intermediate to senior developers

Return exactly 3 titles, numbered 1-3, one per line.`;
    }

    /**
     * Build rich outline prompt
     */
    private buildOutlinePrompt(captures: CaptureItem[], title: string, style: DraftStyle): string {
        const contextSummary = this.summarizeContext(captures);
        const capturesText = captures.map(c => this.formatCaptureForPrompt(c)).join('\n\n');

        return `Create a detailed blog post outline for: "${title}"

## Context
${contextSummary}

## Code Learnings
${capturesText}

Create an outline that:
1. Starts with a compelling introduction (hook + why this matters)
2. Has 3-5 main sections covering the key concepts
3. Includes spots for code examples
4. Addresses common pitfalls or gotchas
5. Ends with actionable takeaways
6. ${style === 'tutorial' ? 'Follows step-by-step structure' : 'Flows naturally'}

Return in Markdown format with ## headers and bullet points.`;
    }

    /**
     * Build rich draft prompt
     */
    private buildDraftPrompt(
        captures: CaptureItem[],
        outline: string,
        title: string,
        style: DraftStyle
    ): string {
        const contextSummary = this.summarizeContext(captures);
        const codeExamples = this.formatCodeExamples(captures);

        const styleGuidelines = {
            'technical': 'Professional tone, precise terminology, assume reader has context',
            'conversational': 'Friendly tone, explain concepts clearly, use "you" and "we"',
            'tutorial': 'Step-by-step instructions, very clear explanations, beginner-friendly',
            'deep-dive': 'Comprehensive analysis, explore edge cases, advanced concepts',
            'quick-tip': 'Concise and actionable, get to the point fast, practical focus'
        };

        return `Write a complete technical blog post.

# Title: ${title}

## Context
${contextSummary}

## Outline
${outline}

## Code Examples to Include
${codeExamples}

## Style Guidelines
${styleGuidelines[style]}

## Requirements
- Write in Markdown format
- Include the code examples with proper syntax highlighting
- Add inline explanations where helpful
- Use ### for main sections, #### for subsections
- Keep paragraphs focused (3-5 sentences)
- Add a brief introduction explaining the problem/motivation
- End with key takeaways and optional next steps
- Target length: ${style === 'quick-tip' ? '400-600' : style === 'deep-dive' ? '1200-1800' : '800-1200'} words

Return ONLY the blog post content in Markdown. Start with a brief introduction (no title needed).`;
    }

    /**
     * Format capture for AI prompt
     */
    private formatCaptureForPrompt(capture: CaptureItem): string {
        let text = `### ${capture.notes || 'Learning Point'}\n\n`;

        if (capture.code) {
            text += `**File:** \`${capture.code.filePath}\`\n`;
            if (capture.context?.functionName) {
                text += `**Function:** \`${capture.context.functionName}\`\n`;
            }
            text += `\n\`\`\`${capture.code.language}\n${capture.code.snippet}\n\`\`\`\n\n`;
        }

        text += `**My notes:** ${capture.notes}\n`;

        if (capture.context?.surroundingCode) {
            text += `\n<details><summary>Surrounding context</summary>\n\n\`\`\`${capture.code?.language || 'text'}\n${capture.context.surroundingCode.substring(0, 500)}...\n\`\`\`\n</details>\n`;
        }

        return text;
    }

    /**
     * Summarize project context from captures
     */
    private summarizeContext(captures: CaptureItem[]): string {
        const contexts = captures.map(c => c.context).filter(c => c);
        if (contexts.length === 0) return 'General software development';

        const frameworks = [...new Set(contexts.map(c => c?.framework).filter(f => f))];
        const languages = [...new Set(captures.map(c => c.code?.language).filter(l => l))];
        const project = contexts[0]?.projectDescription || captures[0]?.metadata.project || 'a project';

        let summary = `Working on ${project}`;
        if (frameworks.length > 0) summary += ` using ${frameworks.join(', ')}`;
        if (languages.length > 0) summary += ` (${languages.join(', ')})`;

        return summary + '.';
    }

    /**
     * Format code examples for inclusion in draft
     */
    private formatCodeExamples(captures: CaptureItem[]): string {
        return captures
            .filter(c => c.code)
            .map((c, idx) => {
                let text = `\n**Example ${idx + 1}:** ${c.notes || 'Code snippet'}\n`;
                text += `\`\`\`${c.code!.language}\n${c.code!.snippet}\n\`\`\`\n`;
                if (c.context?.functionName) {
                    text += `*From \`${c.context.functionName}()\` in ${c.code!.filePath}*\n`;
                }
                return text;
            })
            .join('\n');
    }

    /**
     * System prompts for different tasks
     */
    private getSystemPrompt(task: 'title' | 'outline' | 'draft', style: DraftStyle): string {
        const basePrompts = {
            title: 'You are a technical content advisor helping software engineers create compelling blog post titles. Generate SEO-friendly, specific, developer-focused titles.',
            outline: 'You are a technical writing assistant creating blog post outlines. Structure content logically and ensure it flows well.',
            draft: 'You are an experienced technical writer creating blog posts for software engineers. Write clearly, use code examples effectively, and make complex topics accessible.'
        };

        const styleAdditions = {
            conversational: ' Use a friendly, approachable tone.',
            tutorial: ' Focus on clear step-by-step instructions.',
            'deep-dive': ' Go deep into technical details and edge cases.',
            'quick-tip': ' Be concise and actionable.',
            technical: ' Use precise technical terminology.'
        };

        return basePrompts[task] + styleAdditions[style];
    }

    /**
     * Parse titles from AI response
     */
    private parseTitles(response: string): string[] {
        const lines = response.split('\n');
        const titles: string[] = [];

        for (const line of lines) {
            const match = line.match(/^\d+[.):]\s*(.+)$/);
            if (match) {
                titles.push(match[1].trim());
            }
        }

        return titles.length > 0 ? titles.slice(0, 7) : this.extractAnyTitles(response);
    }

    private extractAnyTitles(response: string): string[] {
        // Fallback: try to find any reasonable lines
        const lines = response.split('\n').filter(l => l.trim().length > 10 && l.trim().length < 100);
        return lines.slice(0, 3);
    }

    /**
     * Fallback titles if AI fails
     */
    private getFallbackTitles(captures: CaptureItem[]): string[] {
        const topics = [...new Set(captures.map(c => c.code?.language).filter(l => l))];
        const topic = topics[0] || 'Code';

        return [
            `Lessons Learned: ${topic} Best Practices`,
            `Understanding ${topic}: A Developer's Journey`,
            `Practical ${topic} Patterns from Real Projects`
        ];
    }
}

// Provider implementations
class SimpleAIProvider implements AIProvider {
    name = 'Simple AI';

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        if (prompt.includes('suggest 3 compelling blog post titles')) {
            return '1. Understanding Modern Development Practices\n2. Lessons Learned from Real-World Coding\n3. A Developer\'s Guide to Better Code';
        }
        return 'Simple AI response - configure a real AI provider in settings for better results.';
    }
}

class OllamaProvider implements AIProvider {
    name = 'Ollama';
    private readonly endpoint: string;
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codedraft');
        this.endpoint = config.get('ai.endpoint', 'http://localhost:11434');
        this.model = config.get('ai.model', 'llama3');
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        const fullPrompt = options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt;

        const response = await fetch(`${this.endpoint}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    num_predict: options.maxTokens || 1000
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();
        // @ts-ignore
        return data.response;
    }
}

class OpenAIProvider implements AIProvider {
    name = 'OpenAI';
    private readonly apiKey: string;
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codedraft');
        this.apiKey = config.get('ai.apiKey', '');
        this.model = config.get('ai.model', 'gpt-4');
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        const messages: any[] = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            // @ts-ignore
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        // @ts-ignore
        return data.choices[0].message.content;
    }
}

class AnthropicProvider implements AIProvider {
    name = 'Anthropic Claude';
    private readonly apiKey: string;
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codedraft');
        this.apiKey = config.get('ai.apiKey', '');
        this.model = config.get('ai.model', 'claude-3-sonnet-20240229');
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: options.maxTokens || 1000,
                system: options.systemPrompt,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            // @ts-ignore
            throw new Error(error.error?.message || 'Anthropic API error');
        }

        const data = await response.json();
        // @ts-ignore
        return data.content[0].text;
    }
}

class GrokProvider implements AIProvider {
    name = 'Grok';
    private readonly apiKey: string;
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codedraft');
        this.apiKey = config.get('ai.apiKey', '');
        this.model = config.get('ai.model', 'grok-beta');
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.length > 0;
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        const messages: any[] = [];
        if (options.systemPrompt) {
            messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 1000
            })
        });

        if (!response.ok) {
            throw new Error('Grok API error');
        }

        const data = await response.json();
        // @ts-ignore
        return data.choices[0].message.content;
    }
}

class CohereProvider implements AIProvider {
    name = 'Cohere';
    private readonly apiKey: string;
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codedraft');
        this.apiKey = config.get('ai.apiKey', '');
        this.model = config.get('ai.model', 'command-a-03-2025');
    }

    async isAvailable(): Promise<boolean> {
        return this.apiKey.trim().length > 0;
    }

    async call(prompt: string, options: AICallOptions): Promise<string> {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

        if (options.systemPrompt) {
            messages.push({
                role: 'system',
                content: options.systemPrompt
            });
        }

        messages.push({
            role: 'user',
            content: prompt
        });

        const response = await fetch('https://production.api.cohere.com/v2/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            // @ts-ignore
            throw new Error(error?.message || 'Cohere API error');
        }

        const data = await response.json();

        /**
         * Cohere responses are NOT OpenAI-shaped.
         * Be explicit and defensive.
         */
        // @ts-ignore
        if (!data.message?.content?.length) {
            throw new Error('Empty response from Cohere');
        }

        // @ts-ignore
        return data.message.content
            .map((part: any) => part.text)
            .join('');
    }
}


