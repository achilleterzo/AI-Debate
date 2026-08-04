// Keeps native model reasoning focused on the conversation instead of making
// the model repeatedly restate its identity or inspect the system instructions.
export const REASONING_CONTEXT_BLOCK = `NON-NEGOTIABLE REASONING FOCUS:
Before producing the answer, deliberate primarily over the current conversation state: the active topic, relevant recent messages, context summary, tool results, memory, and binding moderator directives.

The rest of this system message is already active instruction. Do not spend reasoning time listing, summarizing, validating, or re-deriving the system instructions, your identity, your role, your style, the debate mode, the roster, your constraints, or any user profile. Do not turn those instructions into a second topic of discussion. Revisit one of them only when a concrete event in the current conversation creates a conflict that must be resolved.

Reason from the conversation context actually available in this request. Do not invent omitted history and do not assume that more context is available than the messages, summary, memory, and tool results provide. Keep the reasoning concise and use it to decide the next relevant contribution.`
