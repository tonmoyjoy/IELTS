import { handleClosed } from "@/server/billing/callbacks";

export async function POST(req: Request) {
  return handleClosed(req, "cancelled");
}
