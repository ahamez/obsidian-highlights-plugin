import { ItemView, WorkspaceLeaf } from 'obsidian';
import type HighlightsPlugin from '../main';
import type { HighlightEntry } from './highlights';

export const HIGHLIGHTS_VIEW_TYPE = 'obsidian-highlights-sidebar';

export interface HighlightsPanelState {
  fileName?: string;
  highlights: HighlightEntry[];
  message?: string;
}

export class HighlightsView extends ItemView {
  private container!: HTMLElement;
  private listEl!: HTMLElement;
  private state: HighlightsPanelState = { highlights: [] };

  constructor(leaf: WorkspaceLeaf, private plugin: HighlightsPlugin) {
    super(leaf);
  }

  getDisplayText(): string {
    return 'Highlights';
  }

  getIcon(): string {
    return 'highlighter';
  }

  getViewType(): string {
    return HIGHLIGHTS_VIEW_TYPE;
  }

  async onOpen(): Promise<void> {
    const contentEl = this.containerEl.children[1] as HTMLElement | undefined;
    if (!contentEl) {
      return;
    }

    contentEl.empty();
    contentEl.addClass('highlights-view-content');

    const container = contentEl.createDiv({ cls: 'highlights-panel' });
    this.container = container;

    container.createEl('h2', {
      text: 'Highlights',
      cls: 'highlights-panel__title',
    });

    this.listEl = container.createDiv({ cls: 'highlights-panel__list' });
    this.render();
  }

  async onClose(): Promise<void> {
    const contentEl = this.containerEl.children[1] as HTMLElement | undefined;
    contentEl?.removeClass('highlights-view-content');

    this.plugin.handleViewClosed(this);
  }

  updateState(state: HighlightsPanelState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    if (!this.listEl) {
      return;
    }

    this.listEl.empty();

    if (this.state.message) {
      this.renderMessage(this.state.message);
      return;
    }

    if (!this.state.highlights.length) {
      this.renderMessage(this.state.fileName ? 'No highlights found in this note.' : 'Open a markdown note to view highlights.');
      return;
    }

    if (this.state.fileName) {
      this.listEl.createDiv({
        text: this.state.fileName,
        cls: 'highlights-panel__filename',
      });
    }

    for (const highlight of this.state.highlights) {
      const item = this.listEl.createDiv({ cls: 'highlights-panel__item' });
      item.createDiv({
        text: `${highlight.text}`,
        cls: 'highlights-panel__item-text',
      });
      item.createDiv({
        text: `Line ${highlight.startPosition.line + 1}`,
        cls: 'highlights-panel__item-meta',
      });
      item.addEventListener('click', () => this.plugin.navigateToHighlight(highlight));
    }
  }

  private renderMessage(message: string): void {
    const messageEl = this.listEl.createDiv({
      text: message,
      cls: 'highlights-panel__message',
    });
    messageEl.setAttr('role', 'status');
  }
}
