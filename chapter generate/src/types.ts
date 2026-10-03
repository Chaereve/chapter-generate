export interface StoryBlock {
  id: string;
  title: string;
  leftChars: string;
  rightChars: string;
  content: string;
}

export type TabId = 'story' | 'scanner' | 'links';

export type ServerStatus = 'checking' | 'online' | 'offline';

export type AlertType = 'success' | 'warn' | 'error' | 'info';

export interface AlertState {
  type: AlertType;
  message: string;
}
