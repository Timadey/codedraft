# Changelog

All notable changes to the CodeDraft extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-02
 
### Added
- **Proactive Monitoring**: CodeDraft now intelligently monitors your coding activity (file saves) and suggests capturing learnings when it detects significant changes (refactors, bug fixes).
- **Git Integration**: Automatically analyzes git commits for keywords (e.g., "fix", "refactor") and complexity to suggest captures.
- **Status Bar Integration**: New status bar item shows monitoring status and pending capture count.
- **Automated Triggers**: 
    - Weekly Review reminders on Fridays.
    - Draft generation suggestions after accumulating 5+ captures.
- **Configuration**: New settings to control notification cooldowns, enable/disable proactive mode, and set review schedules.

## [0.1.1] - 2025-12-28

### Updated
- Updated README with new illustrations.

## [0.1.0] - 2025-12-28

### Added
- Initial release of CodeDraft.
- In-flow capture of code snippets and learning notes.
- Git-aware context aggregation.
- AI-powered draft generation (Ollama, OpenAI, Anthropic, Grok).
- Sidebar panel for managing captures and drafts.
- Comprehensive documentation suite (README, CONTRIBUTING, LICENSE, SECURITY).
- Professional visual assets (logo and preview images).
- ESLint and Prettier configuration for code quality.
- Markdown preview of draft content.
