import { handleSuccess } from "@/server/billing/callbacks";

export async function POST(req: Request) {
  return handleSuccess(req);
}
