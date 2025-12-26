import * as vscode from "vscode";
import {AICallOptions, AIProvider} from "./AIProvider";

export class GrokProvider implements AIProvider {
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