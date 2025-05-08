export type Options = {
  eventName?: string;
  endSignal?: string;
  glue?: string;
  replace?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onComplete?: () => void;
  onError?: (error: Event) => void;
};

export type StreamResult = {
  message: string;
  messageParts: string[];
  close: (resetMessage?: boolean) => void;
  clearMessage: () => void;
};
