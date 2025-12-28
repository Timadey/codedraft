<p align="center">
  <img src="https://raw.githubusercontent.com/Timadey/codedraft/3cd963a8eec4b7e32578b66ab041079a7deffd87/assets/icon.png" width="128" alt="CodeDraft Logo" />
</p>

# CodeDraft 📝

**Turn your coding progress into publishable posts, blogs, and docs.**

![CodeDraft Preview](https://raw.githubusercontent.com/Timadey/codedraft/3cd963a8eec4b7e32578b66ab041079a7deffd87/assets/preview.png)

CodeDraft is a Visual Studio Code extension that turns your everyday coding, commits, refactors, and bug fixes , into ready-to-publish drafts. No context switching, no blank page. Share your work effortlessly while staying in your coding workflow.

> **Why CodeDraft Exists:** Most developers ship valuable work every day, and never talk about it. CodeDraft makes publishing a byproduct of coding, not an extra task.

---

## ⚡ How It Works (3 Simple Steps)

### 1️⃣ Capture code & insights while you code
Press **`Ctrl + Shift + C`** to capture a code snippet and record key notes during your coding session.  
CodeDraft automatically includes surrounding context so nothing important is lost.

![CodeDraft Code Capture Illustration](https://raw.githubusercontent.com/Timadey/codedraft/3cd963a8eec4b7e32578b66ab041079a7deffd87/assets/preview.png)

---

### 2️⃣ Generate a draft from your changes
When you’re ready, press **`Ctrl + Shift + G`**.  
CodeDraft analyzes your captured snippets, notes, and Git context to generate a structured draft.

📽 *Illustration video coming here*
<!-- assets/step-2-generate.mp4 or .gif -->

---

### 3️⃣ Copy Markdown and publish
Review the generated draft, then **copy the Markdown** and post it to your blog, LinkedIn, or documentation.

📽 *Illustration video coming here*
<!-- assets/step-3-copy.mp4 or .gif -->

That’s it. No extra tools. No rewriting from scratch.

---


## 🚀 Key Features

- **Publishable Drafts, Fast**: Generate full Markdown drafts or outlines from your recent code changes in seconds.
- **In-Flow Capture**: Select code or commit changes, and capture them for drafting without leaving VS Code.
- **Git Integration**: Pull context from your commits, project structure, and file history automatically.
- **Proactive Draft Suggestions**: After meaningful changes like bug fixes or refactors, CodeDraft nudges you with suggested drafts.
- **Local or Cloud AI**: Generate drafts using local AI (Ollama) or cloud AI providers (OpenAI, Anthropic, Grok).
- **Offline-First**: Keep your drafts private and work locally with Ollama if desired.

---

## 🛠️ Getting Started

### 1. Installation
Install CodeDraft from the VS Code Marketplace.

### 2. Setup AI (Recommended: Ollama)
For local AI generation and privacy:
1. Download and install [Ollama](https://ollama.com/).
2. Run `ollama run llama3` in your terminal.
3. In VS Code settings, set `CodeDraft: AI Provider` to `ollama`.

### 3. Usage
- **Capture Change**: Select code or files, right-click and choose **CodeDraft: Capture Change** (`Cmd+Shift+C`).
- **Generate Draft**: Click the CodeDraft icon in the Activity Bar and hit **Generate Draft** (`Cmd+Shift+G`).
- **Copy & Share**: Review the Markdown draft and copy it directly for your blog, LinkedIn, or docs.

---

## ⚙️ Configuration

CodeDraft is configurable via VS Code Settings (`Ctrl+,`):

| Setting | Description | Default |
|---------|-------------|---------|
| `codedraft.ai.provider` | AI service (ollama, openai, anthropic, grok) | `ollama` |
| `codedraft.ai.model` | Model name (e.g., `llama3`, `gpt-4o`) | `llama3` |
| `codedraft.ai.endpoint` | API endpoint for local AI | `http://localhost:11434` |
| `codedraft.capture.surroundingLines` | Number of lines captured around a selection | `10` |

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

CodeDraft is released under the [ISC License](./LICENSE).

---

Built with ❤️ for developers who want to publish their work without extra effort.
