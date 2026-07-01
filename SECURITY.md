# Security Policy

## Supported Versions

Security updates are provided for the latest released version of AI Debate.

Older versions may contain known vulnerabilities and are not guaranteed to receive security fixes.

## Reporting a Vulnerability

If you discover a security issue, please report it privately instead of opening a public issue.

Please include:

- AI Debate version
- Operating system
- Steps to reproduce the issue
- Expected and actual behavior
- Relevant logs or screenshots, if available

Please do **not** publicly disclose vulnerabilities or proof-of-concept exploits before they have been addressed.

## Security Model

AI Debate is a local desktop application built with Electron and React.

The application does not provide hosted services and does not require any cloud infrastructure.

By design:

- Prompts are sent only to the AI endpoint configured by the user.
- No debate content is intentionally transmitted to third-party services by AI Debate itself.
- Debate sessions and configuration are stored locally unless explicitly exported by the user.
- Exported files remain entirely under the user's control.

## Ollama and Remote Endpoints

AI Debate is primarily designed to work with local Ollama-compatible endpoints.

If a remote endpoint is configured, all prompts, attached documents, generated responses, and conversation data are transmitted directly to that endpoint.

Users are responsible for ensuring that remote providers are trusted and comply with their own privacy and security requirements.

## Attachments

Attached documents are processed exclusively to provide context to the selected AI model.

When using remote AI endpoints, users should avoid attaching confidential or sensitive information unless they fully trust the destination service.

## Third-Party Components

AI Debate relies on third-party libraries and AI runtimes.

Security issues affecting third-party components should be reported to their respective maintainers when appropriate.

Dependency updates are periodically reviewed and incorporated into future releases.

## Out of Scope

The following are generally **not** considered security vulnerabilities:

- Prompt injection performed by language models.
- Incorrect, biased, or misleading AI-generated responses.
- Hallucinations or inaccurate conclusions produced by AI models.
- Vulnerabilities originating exclusively from third-party AI providers or models.
- Security issues affecting user-managed local AI servers.
