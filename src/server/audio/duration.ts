import "server-only";
import { parseBuffer } from "music-metadata";

/**
 * Matroska/WebM element ids used for duration scanning.
 * Browsers' MediaRecorder writes WebM files *without* a Duration element
 * (the stream is written live), so we fall back to reading the largest block
 * timestamp from the clusters.
 */
const ID = {
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMECODE_SCALE: 0x2ad7b1,
  DURATION: 0x4489,
  CLUSTER: 0x1f43b675,
  CLUSTER_TIMECODE: 0xe7,
  SIMPLE_BLOCK: 0xa3,
  BLOCK_GROUP: 0xa0,
  BLOCK: 0xa1,
} as const;

const DESCEND = new Set<number>([ID.SEGMENT, ID.INFO, ID.CLUSTER, ID.BLOCK_GROUP]);

type Vint = { value: number; length: number; unknown: boolean };

function readVint(buf: Buffer, pos: number, keepMarker: boolean): Vint | null {
  if (pos >= buf.length) return null;
  const first = buf[pos];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || pos + length > buf.length) return null;

  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i += 1) {
    const byte = buf[pos + i];
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

function readUint(buf: Buffer, pos: number, size: number): number {
  let value = 0;
  for (let i = 0; i < size; i += 1) value = value * 256 + buf[pos + i];
  return value;
}

/** Returns the WebM/Matroska duration in seconds, or null when it cannot be determined. */
export function scanWebmDurationSeconds(buf: Buffer): number | null {
  let pos = 0;
  let timecodeScale = 1_000_000; // default: 1 ms in nanoseconds
  let declaredDuration = 0;
  let clusterTime = 0;
  let maxTimestamp = -1;

  while (pos < buf.length) {
    const id = readVint(buf, pos, true);
    if (!id) break;
    const size = readVint(buf, pos + id.length, false);
    if (!size) break;
    const dataStart = pos + id.length + size.length;

    if (DESCEND.has(id.value)) {
      if (id.value === ID.CLUSTER) clusterTime = 0;
      pos = dataStart;
      continue;
    }
    if (size.unknown) break;
    const dataEnd = dataStart + size.value;
    if (dataEnd > buf.length) break; // truncated: use what we have so far

    switch (id.value) {
      case ID.TIMECODE_SCALE:
        timecodeScale = readUint(buf, dataStart, size.value) || timecodeScale;
        break;
      case ID.DURATION:
        if (size.value === 4) declaredDuration = buf.readFloatBE(dataStart);
        else if (size.value === 8) declaredDuration = buf.readDoubleBE(dataStart);
        break;
      case ID.CLUSTER_TIMECODE:
        clusterTime = readUint(buf, dataStart, size.value);
        break;
      case ID.SIMPLE_BLOCK:
      case ID.BLOCK: {
        const track = readVint(buf, dataStart, false);
        if (track && dataStart + track.length + 2 <= buf.length) {
          const relative = buf.readInt16BE(dataStart + track.length);
          maxTimestamp = Math.max(maxTimestamp, clusterTime + relative);
        }
        break;
      }
      default:
        break;
    }
    pos = dataEnd;
  }

  const ticks = declaredDuration > 0 ? declaredDuration : maxTimestamp;
  if (ticks < 0) return null;
  return (ticks * timecodeScale) / 1e9;
}

/** Duration of an uploaded recording in seconds, or null if the format could not be read. */
export async function getAudioDurationSeconds(buf: Buffer, mimeType: string): Promise<number | null> {
  try {
    const metadata = await parseBuffer(buf, { mimeType, size: buf.length }, { duration: true, skipCovers: true });
    const duration = metadata.format.duration;
    if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) return duration;
  } catch {
    // fall through to the WebM scanner
  }
  if (/webm|matroska/i.test(mimeType)) {
    const scanned = scanWebmDurationSeconds(buf);
    if (scanned != null && scanned > 0) return scanned;
  }
  return null;
}
