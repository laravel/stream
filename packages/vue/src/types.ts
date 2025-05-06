import { type Ref } from "vue";

export type Options = {
    eventName?: string;
    endSignal?: string;
    glue?: string;
    onMessage?: (event: MessageEvent) => void;
    onComplete?: () => void;
    onError?: (error: Event) => void;
};

export type StreamResult = {
    message: Readonly<Ref<string>>;
    messageParts: Readonly<Ref<readonly string[]>>;
    close: (resetMessage?: boolean) => void;
    clearMessage: () => void;
};
