import * as vscode from 'vscode';

export interface ChangeAnalysis {
    isInteresting: boolean;
    score: number;
    reason?: string;
    type?: 'feature' | 'fix' | 'refactor' | 'test' | 'docs' | 'performance' | 'security';
    complexityDelta?: number;
    suggestedCapture?: {
        selection?: vscode.Range;
        reason: string;
    };
    patterns?: string[];
}

export class ChangeAnalyzer {
    private static readonly MIN_LINES_CHANGED = 10;
    private static readonly SIGNIFICANT_CHANGE_THRESHOLD = 20;
    
    // Track document state for delta analysis
    private documentStates = new Map<string, {
        complexity: number;
        lineCount: number;
        lastAnalyzed: number;
    }>();

    /**
     * Analyze document changes to determine if they are worth capturing
     */
    public async analyzeChange(
        document: vscode.TextDocument,
        contentChanges: ReadonlyArray<vscode.TextDocumentContentChangeEvent>
    ): Promise<ChangeAnalysis> {
        const fileName = document.fileName;
        const addedText = contentChanges.map(c => c.text).join('\n');
        const totalLinesChanged = contentChanges.reduce((acc, change) => {
            return acc + Math.abs(change.text.split('\n').length - change.rangeLength);
        }, 0);

        // Get previous state for delta analysis
        const previousState = this.documentStates.get(fileName);
        const currentComplexity = this.calculateComplexity(document.getText());
        const complexityDelta = previousState ? 
            currentComplexity - previousState.complexity : 0;

        // Update state
        this.documentStates.set(fileName, {
            complexity: currentComplexity,
            lineCount: document.lineCount,
            lastAnalyzed: Date.now()
        });

        // Detect patterns
        const patterns = this.detectPatterns(addedText, document);
        
        // Calculate composite score
        let score = 0;
        let reasons: string[] = [];
        let type: ChangeAnalysis['type'] = 'feature';

        // Pattern-based scoring
        if (patterns.includes('bug-fix')) {
            score += 85;
            reasons.push('Bug fix pattern detected');
            type = 'fix';
        }

        if (patterns.includes('performance')) {
            score += 80;
            reasons.push('Performance optimization');
            type = 'performance';
        }

        if (patterns.includes('security')) {
            score += 90;
            reasons.push('Security improvement');
            type = 'security';
        }

        if (patterns.includes('error-handling')) {
            score += 70;
            reasons.push('Enhanced error handling');
            type = 'fix';
        }

        if (patterns.includes('refactor')) {
            score += 65;
            reasons.push('Code refactoring');
            type = 'refactor';
        }

        if (patterns.includes('new-algorithm')) {
            score += 85;
            reasons.push('New algorithm implementation');
            type = 'feature';
        }

        if (patterns.includes('api-change')) {
            score += 75;
            reasons.push('API design change');
            type = 'feature';
        }

        if (patterns.includes('test-addition')) {
            score += 50;
            reasons.push('Test coverage added');
            type = 'test';
        }

        // Complexity delta bonus
        if (complexityDelta < -5) {
            score += 30;
            reasons.push('Complexity reduced significantly');
        } else if (complexityDelta > 10) {
            score += 20;
            reasons.push('Complex logic added');
        }

        // Size-based scoring
        if (totalLinesChanged > ChangeAnalyzer.SIGNIFICANT_CHANGE_THRESHOLD) {
            score += Math.min(totalLinesChanged * 2, 50);
            reasons.push(`Significant change (${totalLinesChanged} lines)`);
        }

        // Special file types
        if (this.isConfigFile(document)) {
            score += 40;
            reasons.push('Configuration update');
        }

        // Smart selection suggestion
        let suggestedCapture: ChangeAnalysis['suggestedCapture'];
        if (score > 60 && contentChanges.length > 0) {
            // Find the most interesting change region
            const mostInterestingChange = this.findMostInterestingRegion(document, contentChanges);
            if (mostInterestingChange) {
                suggestedCapture = {
                    selection: mostInterestingChange.range,
                    reason: mostInterestingChange.reason
                };
            }
        }

        return {
            isInteresting: score >= 60,
            score: Math.min(score, 100),
            reason: reasons.join('; ') || undefined,
            type,
            complexityDelta,
            suggestedCapture,
            patterns
        };
    }

    /**
     * Detect specific code patterns in changes
     */
    private detectPatterns(text: string, document: vscode.TextDocument): string[] {
        const patterns: string[] = [];
        const lowerText = text.toLowerCase();

        // Bug fix patterns
        if (
            /\b(fix|bug|patch|resolve|correct)\b/i.test(lowerText) ||
            /if\s*\([^)]*null|undefined|empty/.test(text) ||
            /\?\./g.test(text) || // Optional chaining
            /\?\?/g.test(text) ||  // Nullish coalescing
            /\.catch\(/g.test(text)
        ) {
            patterns.push('bug-fix');
        }

        // Performance patterns
        if (
            /\b(memo|usememo|usecallback|optimize|cache|debounce|throttle)\b/i.test(lowerText) ||
            /Promise\.all/i.test(text) ||
            /async.*await/s.test(text) ||
            /@lru_cache|@cache/.test(text)
        ) {
            patterns.push('performance');
        }

        // Security patterns
        if (
            /\b(sanitize|validate|escape|auth|permission|token|encrypt|hash)\b/i.test(lowerText) ||
            /\.test\(|\.match\(/.test(text) || // Regex validation
            /try\s*\{[\s\S]*?\}\s*catch/s.test(text)
        ) {
            patterns.push('security');
        }

        // Error handling
        if (
            /try\s*\{/g.test(text) ||
            /catch\s*\(/g.test(text) ||
            /throw\s+new\s+\w+Error/g.test(text) ||
            /\.catch\(/g.test(text) ||
            /finally\s*\{/g.test(text)
        ) {
            patterns.push('error-handling');
        }

        // Refactoring patterns
        if (
            /\b(refactor|extract|rename|restructure)\b/i.test(lowerText) ||
            /function\s+\w+\s*\([\s\S]*?\)\s*\{/g.test(text) || // New function
            /const\s+\w+\s*=\s*\([^)]*\)\s*=>/g.test(text) || // Arrow function
            /class\s+\w+/g.test(text)
        ) {
            patterns.push('refactor');
        }

        // Algorithm/logic patterns
        if (
            /\b(algorithm|recursive|iterate|traverse|search|sort|filter|reduce|map)\b/i.test(lowerText) ||
            /for\s*\(|while\s*\(/g.test(text) ||
            /\.reduce\(|\.map\(|\.filter\(/g.test(text)
        ) {
            patterns.push('new-algorithm');
        }

        // API changes
        if (
            /export\s+(async\s+)?function/g.test(text) ||
            /export\s+class/g.test(text) ||
            /export\s+interface/g.test(text) ||
            /public\s+async|public\s+\w+\s*\(/g.test(text) ||
            /@api|@endpoint|@route/gi.test(text)
        ) {
            patterns.push('api-change');
        }

        // Test patterns
        if (
            this.isTestFile(document) ||
            /\b(test|describe|it|expect|assert|should)\b/i.test(lowerText) ||
            /@test/i.test(text)
        ) {
            patterns.push('test-addition');
        }

        // React-specific patterns
        if (
            /use(State|Effect|Ref|Context|Reducer|Callback|Memo)/g.test(text) ||
            /<\w+[\s\S]*?>/g.test(text) // JSX
        ) {
            patterns.push('react-pattern');
        }

        // Database/ORM patterns
        if (
            /\b(select|insert|update|delete|query|transaction|migration)\b/i.test(lowerText) ||
            /\.create\(|\.update\(|\.delete\(|\.find\(/g.test(text)
        ) {
            patterns.push('database-operation');
        }

        return patterns;
    }

    /**
     * Find the most interesting region in the changes
     */
    private findMostInterestingRegion(
        document: vscode.TextDocument,
        changes: ReadonlyArray<vscode.TextDocumentContentChangeEvent>
    ): { range: vscode.Range; reason: string } | null {
        let bestScore = 0;
        let bestRegion: { range: vscode.Range; reason: string } | null = null;

        for (const change of changes) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line + change.text.split('\n').length;
            
            // Expand range to include context
            const contextStart = Math.max(0, startLine - 3);
            const contextEnd = Math.min(document.lineCount - 1, endLine + 3);
            const range = new vscode.Range(contextStart, 0, contextEnd, 0);
            
            const regionText = document.getText(range);
            const patterns = this.detectPatterns(regionText, document);
            const complexity = this.calculateComplexity(regionText);
            
            let score = patterns.length * 20 + complexity * 2;
            
            if (score > bestScore) {
                bestScore = score;
                bestRegion = {
                    range,
                    reason: patterns.length > 0 ? 
                        `Contains: ${patterns.join(', ')}` : 
                        'Significant code change'
                };
            }
        }

        return bestRegion;
    }

    /**
     * Enhanced complexity calculation using cyclomatic complexity
     */
    public calculateComplexity(code: string): number {
        let complexity = 1; // Base complexity

        // Conditional statements
        const conditionals = code.match(/if\s*\(|else\s+if|else|switch|case/g);
        if (conditionals) complexity += conditionals.length;

        // Loops
        const loops = code.match(/for\s*\(|while\s*\(|do\s*\{|\.forEach\(|\.map\(|\.filter\(|\.reduce\(/g);
        if (loops) complexity += loops.length;

        // Logical operators
        const logicalOps = code.match(/&&|\|\|/g);
        if (logicalOps) complexity += logicalOps.length;

        // Exception handling
        const exceptions = code.match(/try\s*\{|catch\s*\(|finally/g);
        if (exceptions) complexity += exceptions.length;

        // Ternary operators
        const ternary = code.match(/\?[^:]+:/g);
        if (ternary) complexity += ternary.length;

        // Function calls (potential complexity)
        const functionCalls = code.match(/\w+\s*\(/g);
        if (functionCalls) complexity += Math.min(functionCalls.length * 0.5, 10);

        // Nested structures (estimate)
        const braceDepth = this.calculateBraceDepth(code);
        complexity += braceDepth * 2;

        return Math.round(complexity);
    }

    /**
     * Calculate maximum brace nesting depth
     */
    private calculateBraceDepth(code: string): number {
        let maxDepth = 0;
        let currentDepth = 0;

        for (const char of code) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth--;
            }
        }

        return maxDepth;
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.includes('.test.') ||
            fileName.includes('.spec.') ||
            fileName.includes('/tests/') ||
            fileName.includes('/__tests__/') ||
            fileName.includes('/test/') ||
            fileName.endsWith('_test.ts') ||
            fileName.endsWith('_test.js');
    }

    /**
     * Check if file is a configuration file
     */
    private isConfigFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.endsWith('.json') ||
            fileName.endsWith('.yaml') ||
            fileName.endsWith('.yml') ||
            fileName.endsWith('.toml') ||
            fileName.includes('config') ||
            fileName.includes('.env');
    }

    /**
     * Clean up old document states to prevent memory leaks
     */
    public cleanup(): void {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [key, state] of this.documentStates.entries()) {
            if (now - state.lastAnalyzed > maxAge) {
                this.documentStates.delete(key);
            }
        }
    }
}