export const cookieJar = new Map<string, string>();
export const outbox: Array<{ to: string; subject: string; text: string; html: string }> = [];
