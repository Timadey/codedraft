// Provider implementations
import {AICallOptions, AIProvider} from "./AIProvider";

export class SimpleAIProvider implements AIProvider {
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