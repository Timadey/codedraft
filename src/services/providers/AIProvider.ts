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