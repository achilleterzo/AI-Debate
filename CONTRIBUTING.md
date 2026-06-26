# Contributing

Thank you for your interest in contributing to AI Debate.

Contributions of all sizes are welcome, including bug fixes, documentation improvements, feature suggestions, and code contributions.

## Before You Start

Before opening a pull request:

- Check whether a similar issue or proposal already exists.
- For significant changes, open an issue first to discuss the proposed solution.
- Keep contributions focused on a single topic whenever possible.

## Development Setup

Clone the repository:

```bash
git clone https://github.com/achilleterzo/AI-Debate.git
cd AI-Debate
```

Install dependencies:

```bash
npm install
```

Start the development environment:

```bash
npm run dev
```

Build the desktop application:

```bash
npm run build:desktop
```

## Coding Guidelines

Please follow the existing coding style throughout the project.

When contributing:

- Keep code simple and maintainable.
- Avoid unrelated refactoring in feature branches.
- Prefer descriptive variable and function names.
- Remove unused code before submitting a pull request.
- Ensure the project builds successfully.
- Keep commits focused and logically grouped.

## Architecture Principles

AI Debate is designed to remain provider-agnostic.

The debate engine, participant management, prompt generation, document processing, and analytical features should remain independent from the underlying AI service.

Provider-specific implementations should act as adapters between the application and external AI services rather than modifying the core application logic.

When implementing support for a new AI provider:

- Keep provider-specific logic isolated.
- Reuse the common request and response abstractions whenever possible.
- Avoid introducing provider-specific assumptions into the core.
- Support configurable endpoints and authentication methods where applicable.
- Preserve compatibility with existing provider integrations.

The long-term goal is to allow users to freely choose between local models, self-hosted services, and commercial AI providers through interchangeable integrations.

## Pull Requests

Please make sure your pull request:

- Clearly explains the purpose of the change.
- References any related issue when applicable.
- Includes screenshots for UI changes.
- Does not introduce unrelated modifications.

Small, focused pull requests are preferred over large ones.

## Bug Reports

When reporting a bug, please include:

- AI Debate version.
- Operating system.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Screenshots or logs, when available.

## Feature Requests

Feature requests are always welcome.

Please describe:

- The problem you are trying to solve.
- Your proposed solution.
- Possible alternatives, if applicable.
- Any relevant use cases.

## Code of Conduct

Please be respectful and constructive when interacting with other contributors.

Healthy technical discussions and different opinions are encouraged, provided they remain professional and focused on improving the project.
