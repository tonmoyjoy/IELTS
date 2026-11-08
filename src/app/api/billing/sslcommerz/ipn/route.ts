import { handleIpn } from "@/server/billing/callbacks";

export async function POST(req: Request) {
  return handleIpn(req);
}
