import { debounce, Editor, EditorPosition, MarkdownView, Plugin, TFile } from 'obsidian';
import { collectHighlights, HighlightEntry } from './src/highlights';
import { HighlightsView, HIGHLIGHTS_VIEW_TYPE, HighlightsPanelState } from './src/highlights-view';

const EMPTY_NOTE_MESSAGE = 'Open a markdown note to view highlights.';
const NO_MATCHES_MESSAGE = 'No highlights found in this note.';

export default class HighlightsPlugin extends Plugin {
  private view?: HighlightsView;
  private lastState: HighlightsPanelState = { highlights: [], message: EMPTY_NOTE_MESSAGE };
  private refreshHighlights = debounce(() => this.updateHighlights(), 150);
  private currentMarkdownView: MarkdownView | null = null;

  async onload(): Promise<void> {
    this.registerView(HIGHLIGHTS_VIEW_TYPE, (leaf) => {
      const view = new HighlightsView(leaf, this);
      this.view = view;
      view.updateState(this.lastState);
      return view;
    });

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        void this.ensureHighlightsView();
        const viewType = leaf?.view?.getViewType();
        if (viewType === HIGHLIGHTS_VIEW_TYPE) {
          return;
        }
        this.updateHighlights();
      }),
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (_editor, view) => {
        if (view && view === this.currentMarkdownView) {
          this.refreshHighlights();
        }
      }),
    );

    this.registerEvent(this.app.workspace.on('file-open', () => this.updateHighlights()));

    this.registerEvent(
      this.app.vault.on('rename', (file) => {
        if (file instanceof TFile && this.isActiveFile(file)) {
          this.updateHighlights();
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && this.isActiveFile(file)) {
          this.updateHighlights();
        }
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      void this.ensureHighlightsView();
      this.updateHighlights();
    });
  }

  onunload(): void {
    this.view = undefined;
    this.app.workspace.detachLeavesOfType(HIGHLIGHTS_VIEW_TYPE);
  }

  navigateToHighlight(highlight: HighlightEntry): void {
    const markdownView = this.resolveMarkdownView();
    if (!markdownView) {
      return;
    }

    const editor = markdownView.editor;
    this.currentMarkdownView = markdownView;

    if (this.app.workspace.getActiveViewOfType(MarkdownView) !== markdownView) {
      this.app.workspace.setActiveLeaf(markdownView.leaf, { focus: true });
    }

    window.requestAnimationFrame(() => {
      const { start, end } = this.normalizeHighlightRange(editor, highlight);
      editor.focus();
      editor.setSelection(start, end);
      editor.scrollIntoView({ from: start, to: end }, true);
    });
  }

  handleViewClosed(view: HighlightsView): void {
    if (this.view === view) {
      this.view = undefined;
    }
  }

  private async ensureHighlightsView(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(HIGHLIGHTS_VIEW_TYPE).length > 0) {
      return;
    }

    let leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(true);
    }

    if (!leaf) {
      return;
    }

    await leaf.setViewState({ type: HIGHLIGHTS_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private updateHighlights(): void {
    const markdownView = this.resolveMarkdownView();
    const file = markdownView?.file ?? null;

    if (!markdownView || !file) {
      this.applyState({ highlights: [], message: EMPTY_NOTE_MESSAGE });
      return;
    }

    const content = markdownView.editor.getValue();
    const highlights = collectHighlights(content);

    const state: HighlightsPanelState = {
      highlights,
      fileName: file.basename,
      message: highlights.length ? undefined : NO_MATCHES_MESSAGE,
    };

    this.currentMarkdownView = markdownView;
    this.applyState(state);
  }

  private applyState(state: HighlightsPanelState): void {
    this.lastState = state;
    if (this.view) {
      this.view.updateState(state);
    }
  }

  private resolveMarkdownView(): MarkdownView | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.currentMarkdownView = active;
      return active;
    }

    if (this.currentMarkdownView && this.app.workspace.getLeavesOfType('markdown').some((leaf) => leaf.view === this.currentMarkdownView)) {
      return this.currentMarkdownView;
    }

    return null;
  }

  private isActiveFile(file: TFile): boolean {
    const activeFile = this.resolveMarkdownView()?.file;
    return !!activeFile && activeFile.path === file.path;
  }

  private normalizeHighlightRange(editor: Editor, highlight: HighlightEntry): { start: EditorPosition; end: EditorPosition } {
    const clampPosition = (position: EditorPosition): EditorPosition => {
      const lastLine = editor.lastLine();
      const line = Math.min(Math.max(position.line, 0), lastLine);
      const lineLength = editor.getLine(line)?.length ?? 0;
      const ch = Math.min(Math.max(position.ch, 0), lineLength);
      return { line, ch };
    };

    const start = clampPosition(highlight.startPosition);
    const end = clampPosition(highlight.endPosition);
    if (end.line < start.line || (end.line === start.line && end.ch < start.ch)) {
      return { start: end, end: start };
    }
    return { start, end };
  }
}
