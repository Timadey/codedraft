import * as vscode from 'vscode';
import { CaptureItem } from '../models/CaptureItem';
import { AIProvider } from "./providers/AIProvider";
import { OllamaProvider } from "./providers/OllamaProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AnthropicProvider } from "./providers/AnthropicProvider";
import { GrokProvider } from "./providers/GrokProvider";
import { CohereProvider } from "./providers/CohereProvider";
import { SimpleAIProvider } from "./providers/SimpleAIProvider";

export type DraftStyle = 'technical' | 'conversational' | 'tutorial' | 'deep-dive' | 'quick-tip';
export type GenerationFocus = 'universal' | 'implementation';

export interface GenerationOptions {
    style?: DraftStyle;
    focus?: GenerationFocus;
    customRules?: string;
}

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
    async generateTitle(captures: CaptureItem[], options: GenerationOptions = {}): Promise<string[]> {
        const style = options.style || 'technical';
        const focus = options.focus || 'universal';
        const customRules = options.customRules;

        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildTitlePrompt(captures, style, focus, customRules);
        const systemPrompt = this.getSystemPrompt('title', style, focus);

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
        options: GenerationOptions = {}
    ): Promise<string> {
        const style = options.style || 'technical';
        const focus = options.focus || 'universal';
        const customRules = options.customRules;

        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildOutlinePrompt(captures, title, style, focus, customRules);
        const systemPrompt = this.getSystemPrompt('outline', style, focus);

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
        options: GenerationOptions = {}
    ): Promise<string> {
        const style = options.style || 'technical';
        const focus = options.focus || 'universal';
        const customRules = options.customRules;

        if (!this.provider) {
            await this.initializeProvider();
        }

        const prompt = this.buildDraftPrompt(captures, outline, title, style, focus, customRules);
        const systemPrompt = this.getSystemPrompt('draft', style, focus);

        return await this.provider!.call(prompt, {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 3000
        });
    }

    /**
     * Build rich title prompt with context
     */
    private buildTitlePrompt(captures: CaptureItem[], style: DraftStyle, focus: GenerationFocus, customRules?: string): string {
        const capturesText = captures.map((c, idx) => {
            // ... (keep same capture text formatting)
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

        const focusReqs = focus === 'universal'
            ? `- Abstract the core technical lesson into a title that any developer can relate to and find valuable.
- Avoid using project-specific names or local context in the titles unless they are industry-standard names (e.g., "React", "Docker").`
            : `- Focus on the specific implementation in the codebase.
- Use specific function names, file paths, and project components where relevant.`;

        const rulesText = customRules ? `\n\n**Special Instructions/Custom Rules:**\n${customRules}` : '';

        return `Based on these code learnings, suggest 5 compelling technical blog post titles.

${capturesText}

Requirements:
${focusReqs}
- Focus on the "What", "Why", or "How-To" of the technical solution.
- ${style === 'conversational' ? 'Friendly and approachable' : 'Professional and technical'}
- SEO-friendly with relevant keywords
- Clear and specific about the content being shared
- 50-70 characters each
- Audience: ${focus === 'universal' ? 'intermediate to senior developers' : 'developers working on this specific codebase'}${rulesText}

Return exactly 5 titles, numbered 1-5, one per line.`;
    }

    /**
     * Build rich outline prompt
     */
    private buildOutlinePrompt(captures: CaptureItem[], title: string, style: DraftStyle, focus: GenerationFocus, customRules?: string): string {
        const contextSummary = this.summarizeContext(captures);
        const capturesText = captures.map(c => this.formatCaptureForPrompt(c)).join('\n\n');
        const rulesText = customRules ? `\n\n**Special Instructions/Custom Rules:**\n${customRules}` : '';

        const focusInstructions = focus === 'universal'
            ? `1. Starts with a compelling introduction (hook + the universal problem this addresses)
2. Focuses on general principles, technical trade-offs, and best practices derived from these captures
3. Addresses "Why this matters" for any developer encounter similar technical challenges`
            : `1. Starts with a technical introduction (the specific module being implemented and why)
2. Focuses on the codebase architecture, file-by-file changes, and specific implementation logic
3. Addresses implementation details, code structure, and internal dependencies`;

        return `Create a detailed blog post outline for: "${title}"

## Context
${contextSummary}

## Code Learnings
${capturesText}

Create an outline that:
${focusInstructions}
4. Has 3-5 main sections that flow logically from problem statement to solution and insights
5. Includes strategic spots for code examples to illustrate core concepts
6. ${style === 'tutorial' ? 'Follows step-by-step structure' : 'Connects concepts through a narrative format'}
${rulesText}

Return in Markdown format with ## headers and bullet points.`;
    }

    /**
     * Build rich draft prompt
     */
    private buildDraftPrompt(
        captures: CaptureItem[],
        outline: string,
        title: string,
        style: DraftStyle,
        focus: GenerationFocus,
        customRules?: string
    ): string {
        const contextSummary = this.summarizeContext(captures);
        const codeExamples = this.formatCodeExamples(captures);
        const rulesText = customRules ? `\n\n**Special Instructions/Custom Rules:**\n${customRules}` : '';

        const styleGuidelines = {
            'technical': 'Professional tone, precise terminology, emphasize the architecture and logic',
            'conversational': 'Friendly, mentor-like tone, explain concepts clearly, use "you" and "we" to build shared experience',
            'tutorial': 'Clear instructions, explain the "why" behind each implementation step, focus on reproducibility',
            'deep-dive': 'Comprehensive analysis, explore nuances and edge cases, connect details to broader principles',
            'quick-tip': 'Concise and immediately actionable, focusing on specific high-value implementation or pattern'
        };

        const focusInstructions = focus === 'universal'
            ? `- Frame the content so it is relatable to any developer, regardless of whether they are on your specific project.
- Focus on extracting and explaining knowledge that has lasting value beyond the current task.
- Start with an introduction that defines a common developer pain point or curiosity.
- End with "Key Insights" or "Takeaways" that the reader can apply to their own work.`
            : `- Focus on the specific implementation in this codebase.
- Name specific files, function names, and project-specific components used in the captures.
- Explain the implementation logic and decision-making for this exact problem.
- Start with an introduction explaining the goal of the implementation.
- End with "Implementation Summary" or "Development Notes".`;

        return `Write a complete technical blog post.

# Title: ${title}

## Context ${focus === 'universal' ? '(for your reference, do not mention project-specific names)' : '(use these project specifics freely)'}
${contextSummary}

## Outline
${outline}

## Code Examples (use these as concrete illustrations)
${codeExamples}

## Style Guidelines
${styleGuidelines[style]}

## Requirements
- Write in Markdown format
${focusInstructions}
- Use the provided code captures as evidence for the implementation or patterns you are describing.
- Include the code examples with proper syntax highlighting.
- Use ### for main sections, #### for subsections.
- Keep paragraphs focused (3-5 sentences).
- Target length: ${style === 'quick-tip' ? '400-600' : style === 'deep-dive' ? '1200-1800' : '800-1200'} words
${rulesText}

Return ONLY the blog post content in Markdown.`;
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

        if (capture.context?.commitMessage) {
            text += `\n**Related Git Commit:** ${capture.context.commitMessage} (${capture.context.commitHash})\n`;
        }

        if (capture.context?.diff) {
            text += `\n**Git Diff Context:**\n\`\`\`diff\n${capture.context.diff.substring(0, 1000)}${capture.context.diff.length > 1000 ? '\n... [diff truncated]' : ''}\n\`\`\`\n`;
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
    private getSystemPrompt(task: 'title' | 'outline' | 'draft', style: DraftStyle, focus: GenerationFocus): string {
        const basePrompts = {
            title: focus === 'universal'
                ? 'You are a senior technical advisor. Your goal is to transform specific coding tasks into universally relatable, insight-driven, SEO friendly, technical blog titles. You excel at abstracting the "core lesson" from specific project context.'
                : 'You are a technical documentarian. Your goal is to create precise, SEO friendly titles for a technical implementation guide. Focus on naming specific technologies, files, and functions used in the codebase.',
            outline: focus === 'universal'
                ? 'You are a master technical writer. You create outlines that bridge the gap between a specific code fix and the universal engineering principles it demonstrates. You structure content to maximize knowledge sharing.'
                : 'You are a technical architect documenting a project. You create detailed outlines for implementation guides, focusing on explaining the internal logic, structure, and dependencies of the specific codebase.',
            draft: focus === 'universal'
                ? 'You are a mentor and senior engineer sharing high-value technical insights. You write for an audience of peers who want to understand patterns, trade-offs, and "the better way" to solve problems, using specific examples as concrete evidence for general truths.'
                : 'You are an engineer writing a detailed walkthrough of your implementation. You explain *exactly* how the code was built, naming files, functions, and project-specific components. Your goal is to help other developers on the *same project* understand your technical decisions.'
        };

        const styleAdditions = {
            conversational: ' Use a friendly, approachable, and relatable tone as if sharing with a colleague over coffee.',
            tutorial: ' Focus on clear, reproducible steps while explaining the universal "why" behind each action.',
            'deep-dive': ' Provide comprehensive analysis, exploring technical nuances, trade-offs, and underlying principles.',
            'quick-tip': ' Be concise, high-impact, and immediately actionable.',
            technical: ' Use precise terminology and focus on architectural elegance and pattern implementation.'
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
