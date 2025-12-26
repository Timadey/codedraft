import vscode from "vscode";
import {AICallOptions, AIProvider} from "./AIProvider";

export class OllamaProvider implements AIProvider {
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