import { MessageEvent } from "#/types/agent-server/core";
import i18n from "#/i18n";
import { I18nKey } from "#/i18n/declaration";

export const sanitizeAgentProse = (text: string): string => {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove XML tool call tags <tool_call>...</tool_call> and <tools>...</tools>
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  cleaned = cleaned.replace(/<tools>[\s\S]*?<\/tools>/gi, "");

  // 2. Remove fenced markdown code blocks containing tool JSON
  cleaned = cleaned.replace(/```(?:json)?\s*\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?\}\s*```/gi, "");

  // 3. Remove bare tool JSON blocks {"name": "terminal", ...}
  cleaned = cleaned.replace(
    /\{\s*"name"\s*:\s*"(?:terminal|execute_bash|file_editor|edit_file|view_file|browser|web_search|str_replace_editor|bash|run_bash|sh)"\s*,\s*"(?:arguments|parameters|security_risk)"[\s\S]*?\}(?=\s*(\{|\n|$))/gi,
    "",
  );

  // 4. Remove standalone JSON objects containing command / summary
  cleaned = cleaned.replace(
    /\{\s*"security_risk"\s*:[\s\S]*?"command"\s*:[\s\S]*?\}(?=\s*(\{|\n|$))/gi,
    "",
  );

  // 5. Replace literal "\n" string escapes with actual newlines
  cleaned = cleaned.replace(/\\n/g, "\n");

  // 6. Clean up trailing/excess empty lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
};

export const parseMessageFromEvent = (event: MessageEvent): string => {
  const message = event.llm_message;

  // Safety check: ensure llm_message exists and has content
  if (!message?.content) {
    return "";
  }

  // Get the text content from the message
  let textContent = "";
  if (message.content) {
    if (Array.isArray(message.content)) {
      // Handle array of content blocks
      textContent = message.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n");
    } else if (typeof message.content === "string") {
      // Handle string content
      textContent = message.content;
    }
  }

  // Check if there are image_urls in the message content
  const hasImages =
    Array.isArray(message.content) &&
    message.content.some((content) => content.type === "image");

  let result = textContent;
  if (hasImages) {
    const delimiter = i18n.t(I18nKey.CHAT_INTERFACE$AUGMENTED_PROMPT_FILES_TITLE);
    const parts = textContent.split(delimiter);
    result = parts[0];
  }

  if (event.source === "agent") {
    result = sanitizeAgentProse(result);
  }

  return result;
};

