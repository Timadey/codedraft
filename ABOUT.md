# CodeDraft: Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** December 25, 2025  
**Author:** Grok (Researcher) & Timadey (Product Owner/Engineer)

---

## 1. Executive Summary

**Product Name:** CodeDraft  
**Tagline:** *"Turn your code learnings into blog drafts — automatically."*

CodeDraft is a Visual Studio Code (VS Code) extension designed for software engineers who struggle to maintain a consistent technical writing habit. By integrating directly into the developer's primary workflow (coding and Git), CodeDraft captures insights "in-flow," aggregates them intelligently, and generates ready-to-publish drafts.

> [!IMPORTANT]
> **Unique Value Proposition:** Unlike existing blogging extensions, CodeDraft is *proactive*. It captures learnings from code selections and commits automatically, using AI to suggest and outline drafts tailored specifically for developers.

### Target Users
- Software engineers
- Indie hackers
- Open-source contributors
- *Goal: 10k+ monthly active users in Year 1.*

### Business Goals
- **Viral Adoption:** Free core version for the developer community.
- **Freemium Monetization:** Pro tier for advanced AI features and unlimited usage.
- **Community:** Build a "coding-to-content" ecosystem.

---

## 2. Problem Statement & Market Gap

Engineers often face several friction points when it comes to technical writing:
- **Context Switching:** Writing is viewed as a distraction from "productive" coding.
- **Idea Loss:** Valuable insights gained during debugging or refactoring are lost.
- **Perfectionism:** Starting from a blank page leads to stalled drafts.

### Market Gap
- **Publishing-focused:** Tools like BlogTo or CodeWrite focus on the *act* of publishing, not the *creation* process.
- **Git-focused:** Tools like GitLens provide history but don't bridge the gap to content creation.
- **Opportunity:** A VS Code-native tool that feels like GitLens but for content creators.

---

## 3. Objectives & Success Metrics

### Primary Objectives
1. Reduce time to create a publishable draft from hours to minutes.
2. Increase user publishing frequency (Target: 2x more posts per month).

### KPIs (Post-Launch)
- **Installs:** 5k in the first 3 months.
- **Retention:** 30% active user retention at 30 days.
- **Satisfaction:** NPS > 7.
- **Conversion:** 5-10% to Pro tier.

---

## 4. User Personas

| Persona | Goal | Pain Point |
|---------|------|------------|
| **Busy Full-Time Engineer** | Build personal brand. | No energy for separate writing sessions after work. |
| **Indie Hacker** | "Build in public" for audience growth. | Needs quick, authentic content from daily builds. |
| **Open-Source Contributor** | Document complex contributions. | Documentation often feels like an afterthought. |

---

## 5. Roadmap & Features

### Phase 1: MVP (4-6 Weeks)
- **In-Flow Capture (Must-Have)**
  - Sidebar panel for quick notes.
  - "Add Learning" command via hotkey.
  - Snippet capture with optional comments.
  - Local storage in `.codedraft/` folder.
- **Aggregation & Review**
  - Weekly review command to summarize recent learnings and commits.
- **AI Draft Generation**
  - Local AI integration (Ollama) or Cloud APIs (Grok/Claude/OpenAI).
  - Outlining and title suggestion logic.
- **Draft Management**
  - Markdown exports and basic preview.

### Phase 2: Growth & Monetization
- **Passive Monitoring:** Auto-prompt on "interesting" commits (e.g., deep refactors).
- **One-Click Publishing:** Integration with Dev.to, Hashnode, and Medium.
- **Pro Features:** Unlimited cloud AI queries and cross-posting analytics.

---

## 6. Technical Requirements

- **Platform:** TypeScript / VS Code Extension API.
- **Security:** API keys stored in VS Code Secrets (never committed).
- **Offline-First:** Core capture features must work without an internet connection.
- **Compatibility:** VS Code 1.80+ (Windows, macOS, Linux).

---

## 7. Risks & Mitigations

- **AI Quality:** Allow user-defined prompts and local model overrides.
- **Privacy:** Local-first architecture; clear warnings for cloud AI usage.
- **Git Limits:** Use standard public APIs to avoid deep repo scanning issues.

---

## 8. UI/UX Guidelines

- **Sidebar Icon:** Notebook with a code symbol.
- **Minimalist Design:** Tree view for captures, Webview for AI previews.
- **Theme Support:** Native dark/light theme compatibility.
