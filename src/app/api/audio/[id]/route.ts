import { Types } from "mongoose";
import { ApiError, handler } from "@/server/http/api";
import { connectDb } from "@/server/db";
import { AudioClip } from "@/server/models/AudioClip";

/**
 * Serves generated audio (listening recordings and examiner questions for
 * admin-published content). Clips never change, so they are cached for a
 * year. Byte ranges are supported because Safari requires them for <audio>.
 */
export const GET = handler<RouteContext<"/api/audio/[id]">>("audio.get", async (req, ctx) => {
  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "NOT_FOUND", "Not found.");
  await connectDb();
  const clip = await AudioClip.findById(id).select("data mimeType bytes").lean<{ data: { buffer: ArrayBuffer } | Buffer; mimeType: string }>();
  if (!clip) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const raw = clip.data as unknown as { buffer?: Buffer | ArrayBuffer } & Buffer;
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
  const headers: Record<string, string> = {
    "Content-Type": clip.mimeType || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = body.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const slice = body.subarray(start, end + 1);
    return new Response(new Uint8Array(slice), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(slice.length) },
    });
  }
  return new Response(new Uint8Array(body), { status: 200, headers: { ...headers, "Content-Length": String(body.length) } });
});
