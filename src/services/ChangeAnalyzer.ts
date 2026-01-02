import * as vscode from 'vscode';

export interface ChangeAnalysis {
    isInteresting: boolean;
    score: number;
    reason?: string;
    type?: 'feature' | 'fix' | 'refactor' | 'test' | 'docs';
    complexityDelta?: number;
}

export class ChangeAnalyzer {
    private static readonly MIN_LINES_CHANGED = 10;
    private static readonly SIGNIFICANT_CHANGE_THRESHOLD = 20;

    /**
     * Analyze document changes to determine if they are worth capturing
     */
    public async analyzeChange(
        document: vscode.TextDocument,
        contentChanges: ReadonlyArray<vscode.TextDocumentContentChangeEvent>
    ): Promise<ChangeAnalysis> {
        // Skip small changes unless they match specific patterns
        const totalLinesChanged = contentChanges.reduce((acc, change) => {
            return acc + (change.text.split('\n').length - 1);
        }, 0);

        // Basic heuristics
        if (this.isTestFile(document)) {
            return {
                isInteresting: totalLinesChanged > 5,
                score: totalLinesChanged * 0.5,
                reason: 'Test file update',
                type: 'test'
            };
        }

        // Logic patterns
        const addedText = contentChanges.map(c => c.text).join('\n');

        if (this.containsBugFixPatterns(addedText)) {
            return {
                isInteresting: true,
                score: 80,
                reason: 'Potential bug fix detected',
                type: 'fix'
            };
        }

        if (totalLinesChanged > ChangeAnalyzer.SIGNIFICANT_CHANGE_THRESHOLD) {
            return {
                isInteresting: true,
                score: Math.min(totalLinesChanged, 100),
                reason: 'Significant code modification',
                type: 'feature'
            };
        }

        return {
            isInteresting: false,
            score: 0
        };
    }

    private isTestFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.includes('.test.') ||
            fileName.includes('.spec.') ||
            fileName.includes('/tests/') ||
            fileName.includes('/__tests__/');
    }

    private containsBugFixPatterns(text: string): boolean {
        const patterns = [
            /if\s*\(/,           // Conditional check
            /try\s*\{/,          // Error handling
            /\.catch\(/,         // Promise error handling
            /throw\s+new/,       // Error throwing
            /\?\./,              // Optional chaining
            /\?\?/               // Nullish coalescing
        ];

        return patterns.some(p => p.test(text));
    }

    /**
     * Calculate a simple complexity score for a code block
     * (Placeholder for more advanced cyclomatic complexity analysis)
     */
    public calculateComplexity(code: string): number {
        let complexity = 1;
        const matches = code.match(/if|for|while|case|catch|&&|\|\||\?|throw/g);
        if (matches) {
            complexity += matches.length;
        }
        return complexity;
    }
}
