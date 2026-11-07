/** Minimal server-sent-events reader for fetch() responses. */
export type SseEvent = { event: string; data: unknown };

export function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

export async function readSse(res: Response, onEvent: (event: SseEvent) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const parsed = parseSseBlock(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (parsed) onEvent(parsed);
      boundary = buffer.indexOf("\n\n");
    }
  }
  const tail = parseSseBlock(buffer);
  if (tail) onEvent(tail);
}
