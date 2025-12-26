import vscode from "vscode";
import {AICallOptions, AIProvider} from "./AIProvider";

export class AnthropicProvider implements AIProvider {
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