import vscode from "vscode";
import {AICallOptions, AIProvider} from "./AIProvider";

export class CohereProvider implements AIProvider {
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