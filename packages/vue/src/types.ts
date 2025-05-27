import { type Ref } from "vue";

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
    message: Readonly<Ref<string>>;
    messageParts: Readonly<Ref<readonly string[]>>;
    close: (resetMessage?: boolean) => void;
    clearMessage: () => void;
};

export type StreamOptions<TSendBody extends Record<string, any> = {}> = {
    id?: string;
    initialInput?: TSendBody;
    headers?: Record<string, string>;
    csrfToken?: string;
    json?: boolean;
    credentials?: RequestCredentials;
    onResponse?: (response: Response) => void;
    onData?: (data: string) => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onError?: (error: Error) => void;
    onBeforeSend?: (request: RequestInit) => boolean | RequestInit | void;
};

export type Callback =
    | "onData"
    | "onError"
    | "onFinish"
    | "onResponse"
    | "onCancel"
    | "onBeforeSend";

export type RequiredCallbacks = Required<Pick<StreamOptions, Callback>>;

export type StreamMeta<TJsonData = null> = {
    controller: AbortController;
    data: string;
    isFetching: boolean;
    isStreaming: boolean;
    jsonData: TJsonData | null;
};

export type StreamListenerCallback<TJsonData = null> = (
    stream: StreamMeta<TJsonData>,
) => void;
