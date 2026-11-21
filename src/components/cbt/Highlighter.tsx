"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { addRange, removeRange, segments, type Highlights, type Range } from "@/lib/highlights";

export type { Highlights, Range };

function offsetWithin(container: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

type Toolbar = { x: number; y: number; picks: Array<{ key: string; range: Range }>; onMark: boolean };

/**
 * Wraps a passage. Children mark highlightable blocks with
 * `data-hl="<key>"` and render text through <MarkedText>. Selecting text shows
 * a small Highlight / Clear toolbar, as in the computer-delivered test.
 */
export function HighlightArea({
  highlights,
  onChange,
  children,
  disabled = false,
}: {
  highlights: Highlights;
  onChange: (next: Highlights) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);

  const readSelection = useCallback(() => {
    const area = areaRef.current;
    const selection = window.getSelection();
    if (!area || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!area.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const picks: Toolbar["picks"] = [];
    area.querySelectorAll<HTMLElement>("[data-hl]").forEach((block) => {
      if (!range.intersectsNode(block)) return;
      const length = block.textContent?.length ?? 0;
      const start = block.contains(range.startContainer) ? offsetWithin(block, range.startContainer, range.startOffset) : 0;
      const end = block.contains(range.endContainer) ? offsetWithin(block, range.endContainer, range.endOffset) : length;
      if (end > start) picks.push({ key: block.dataset.hl!, range: [start, end] });
    });
    if (picks.length === 0) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const onMark = picks.some(({ key, range: [s, e] }) => (highlights[key] ?? []).some(([a, b]) => a < e && b > s));
    setToolbar({ x: rect.left + rect.width / 2, y: rect.top, picks, onMark });
  }, [highlights]);

  useEffect(() => {
    if (disabled) return;
    const onSelectionEnd = () => window.setTimeout(readSelection, 0);
    const area = areaRef.current;
    area?.addEventListener("mouseup", onSelectionEnd);
    area?.addEventListener("touchend", onSelectionEnd);
    area?.addEventListener("keyup", onSelectionEnd);
    return () => {
      area?.removeEventListener("mouseup", onSelectionEnd);
      area?.removeEventListener("touchend", onSelectionEnd);
      area?.removeEventListener("keyup", onSelectionEnd);
    };
  }, [readSelection, disabled]);

  useEffect(() => {
    if (!toolbar) return;
    const close = () => setToolbar(null);
    const scroller = areaRef.current?.closest("[data-scroll]");
    scroller?.addEventListener("scroll", close);
    return () => scroller?.removeEventListener("scroll", close);
  }, [toolbar]);

  function apply(mode: "add" | "remove") {
    if (!toolbar) return;
    const next = { ...highlights };
    for (const { key, range } of toolbar.picks) {
      next[key] = mode === "add" ? addRange(next[key] ?? [], range) : removeRange(next[key] ?? [], range);
    }
    onChange(next);
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  }

  return (
    <div ref={areaRef} className="relative">
      {children}
      {toolbar && (
        <div
          className="fixed z-[55] flex -translate-x-1/2 -translate-y-full gap-1 rounded-lg border border-line bg-raised p-1 shadow-lift"
          style={{ left: toolbar.x, top: toolbar.y - 6 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button type="button" className="rounded-md bg-mark px-2.5 py-1 text-xs font-semibold text-ink" onClick={() => apply("add")}>
            Highlight
          </button>
          {toolbar.onMark && (
            <button type="button" className="rounded-md px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-sunken" onClick={() => apply("remove")}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MarkedText({ text, ranges = [] }: { text: string; ranges?: Range[] }) {
  return (
    <>
      {segments(text, ranges).map((segment) =>
        segment.marked ? (
          <mark key={segment.start} className="rounded-sm bg-mark text-ink">
            {segment.text}
          </mark>
        ) : (
          <span key={segment.start}>{segment.text}</span>
        )
      )}
    </>
  );
}
