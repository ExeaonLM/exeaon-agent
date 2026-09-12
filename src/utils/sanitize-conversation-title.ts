/**
 * Cleans up raw LLM thoughts, prompt artifacts, and response prefixes from conversation titles.
 */
export function sanitizeConversationTitle(title: string | null | undefined): string {
  if (!title) return "New Conversation";

  let clean = title;

  // Strip <think>...</think> blocks
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/<think>[\s\S]*/gi, "");

  // Strip common conversational / template prefixes
  clean = clean.replace(/^(?:and\s+)?(?:the\s+)?(?:assistant['']?s\s+)?response\s+was:?\s*/i, "");
  clean = clean.replace(/^(?:and\s+)?(?:the\s+)?assistant\s+replied:?\s*/i, "");
  clean = clean.replace(/^(?:Okay|Ok|Sure|Here),\s*(?:the\s+user\s+wants\s+(?:me\s+to\s+)?|I\s+need\s+to\s+|I\s+will\s+)?/i, "");
  clean = clean.replace(/^user:\s*/i, "");
  clean = clean.replace(/^assistant:\s*/i, "");

  // Trim leading/trailing punctuation and whitespace
  clean = clean.replace(/^[\s:,-]+/, "").replace(/[\s:,-]+$/, "").trim();

  // If cleaning resulted in empty string, fallback to original or generic title
  if (!clean) {
    return "Conversation";
  }

  // Capitalize first letter
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
