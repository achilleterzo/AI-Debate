/**
 * How a participant reads, and cites, the `[#id]` markers in its payload.
 *
 * Every message in the conversation arrives announced by its own id. The marker
 * is addressing metadata, not something anyone said: a model that copies it into
 * its answer makes the transcript unreadable and, worse, makes readers believe
 * an id is part of the argument. The block below says both things — what the
 * markers are for, and that they never belong in visible text.
 */

const ID_INTRODUCTION = `Every message written by someone else is announced by an id marker of the form [#12] placed before it. The id identifies that exact message and never changes. Your own past turns are shown to you without a marker. The get_recent_messages tool returns the same ids in its "id" field.

The markers are addressing metadata, not content. Never write [#12], "#12", "message 12" or any id in your visible response, and never treat an id as something a participant said.`

const QUOTE_INSTRUCTION = `To answer, contest, or build on one specific message, cite it with the quote_message tool: pass its id, and optionally a verbatim fragment of it as "excerpt". The tool returns the full text of that message and attaches the citation to your turn, so every reader and every other participant can see exactly which message you are replying to.

Quote the message you are actually responding to, not your own previous turns, and cite before or while making the point that answers it. One or two citations in a turn is normal; do not cite every message you mention in passing. The citation is shown on its own, so keep writing your answer as ordinary prose — do not announce the citation, do not paste the quoted text again, and never invent an excerpt: pass only wording that literally appears in the message you are citing.`

const NO_QUOTE_INSTRUCTION = `No citation tool is available in this turn, so refer to a message by naming its author and what they said, in plain prose. Do not write its id.`

export function buildMessageReferenceBlock({ quoteToolAvailable = false } = {}) {
  return [ID_INTRODUCTION, quoteToolAvailable ? QUOTE_INSTRUCTION : NO_QUOTE_INSTRUCTION].join('\n\n')
}
