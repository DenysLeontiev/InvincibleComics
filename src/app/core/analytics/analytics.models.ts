export type AnalyticsEvent =
  | 'page_view'
  | 'open_issue'
  | 'issue_start'
  | 'comic_page'
  | 'issue_complete'
  | 'page_error'
  | 'layout_change'
  | 'fit_change'
  | 'filter_change'
  | 'language_change'
  | 'fullscreen'
  | 'jump_to_issue'
  | 'mark_read'
  | 'reset_progress'
  | 'github_click'
  | 'app_error';

export interface AnalyticsParams {
  readonly page_location?: string;
  readonly page_path?: string;
  readonly page_title?: string;
  readonly page_type?: 'library' | 'reader';
  readonly issue_number?: number;
  readonly page_number?: number;
  readonly page_count?: number;
  readonly progress?: number;
  readonly source?: string;
  readonly option?: string;
}

export type ConsentChoice = 'granted' | 'denied';
