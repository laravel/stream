export type EventStreamOptions = {
    eventName?: string | string[];
    endSignal?: string;
    glue?: string;
    replace?: boolean;
    onMessage?: (event: MessageEvent) => void;
    onComplete?: () => void;
    onError?: (error: Event) => void;
};

export type EventStreamResult = {
    message: string;
    messageParts: string[];
    close: (resetMessage?: boolean) => void;
    clearMessage: () => void;
};

export type StreamOptions = {
    id?: string;
    initialInput?: Record<string, any>;
    headers?: Record<string, string>;
    csrfToken?: string;
    onResponse?: (response: Response) => void;
    onData?: (data: string) => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onError?: (error: Error) => void;
};

export type StreamMeta = {
    controller: AbortController;
    data: string;
    isFetching: boolean;
    isStreaming: boolean;
};

export type StreamListenerCallback = (stream: StreamMeta) => void;
