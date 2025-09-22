import type { EditorPosition } from 'obsidian';

export interface HighlightEntry {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  startPosition: EditorPosition;
  endPosition: EditorPosition;
}

const HIGHLIGHT_PATTERN = /==([\s\S]*?)==/g;

/**
 * Extracts Obsidian-style highlights (wrapped in ==) from the provided markdown content.
 */
export function collectHighlights(content: string): HighlightEntry[] {
  if (!content) {
    return [];
  }

  HIGHLIGHT_PATTERN.lastIndex = 0;

  const entries: HighlightEntry[] = [];
  const lineOffsets = buildLineOffsets(content);
  let match: RegExpExecArray | null;

  while ((match = HIGHLIGHT_PATTERN.exec(content)) !== null) {
    const rawText = match[1];
    const displayText = rawText.trim();

    if (!displayText) {
      continue;
    }

    const startOffset = match.index + 2; // skip the opening ==
    const endOffset = startOffset + rawText.length;
    const startPosition = offsetToEditorPosition(content, startOffset, lineOffsets);
    const endPosition = offsetToEditorPosition(content, endOffset, lineOffsets);

    entries.push({
      id: `${startPosition.line}:${startPosition.ch}:${startOffset}`,
      text: displayText,
      startOffset,
      endOffset,
      startPosition,
      endPosition,
    });
  }

  return entries;
}

function buildLineOffsets(content: string): number[] {
  const offsets: number[] = [0];

  for (let idx = 0; idx < content.length; idx++) {
    if (content.charCodeAt(idx) === 10 /* \n */) {
      offsets.push(idx + 1);
    }
  }

  return offsets;
}

function offsetToEditorPosition(content: string, offset: number, lineOffsets: number[]): EditorPosition {
  if (offset <= 0) {
    return { line: 0, ch: 0 };
  }

  const safeOffset = Math.min(offset, content.length);
  const line = findLineForOffset(lineOffsets, safeOffset);
  const lineStart = lineOffsets[line] ?? 0;
  const ch = safeOffset - lineStart;

  return { line, ch };
}

function findLineForOffset(lineOffsets: number[], offset: number): number {
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = lineOffsets[mid];
    const nextLineStart = mid + 1 < lineOffsets.length ? lineOffsets[mid + 1] : Number.POSITIVE_INFINITY;

    if (offset < lineStart) {
      high = mid - 1;
    } else if (offset >= nextLineStart) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, lineOffsets.length - 1);
}
