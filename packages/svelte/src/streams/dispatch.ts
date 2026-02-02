import { Callback, RequiredCallbacks, StreamOptions } from "../types";

const callbacks = new Map<
    string,
    {
        onData: RequiredCallbacks["onData"][];
        onError: RequiredCallbacks["onError"][];
        onFinish: RequiredCallbacks["onFinish"][];
        onResponse: RequiredCallbacks["onResponse"][];
        onCancel: RequiredCallbacks["onCancel"][];
        onBeforeSend: RequiredCallbacks["onBeforeSend"][];
    }
>();

export const addCallbacks = (id: string, options: StreamOptions) => {
    if (!callbacks.has(id)) {
        callbacks.set(id, {
            onData: [],
            onError: [],
            onFinish: [],
            onResponse: [],
            onCancel: [],
            onBeforeSend: [],
        });
    }

    const streamCallbacks = callbacks.get(id)!;

    if (options.onData) {
        streamCallbacks.onData.push(options.onData);
    }

    if (options.onError) {
        streamCallbacks.onError.push(options.onError);
    }

    if (options.onFinish) {
        streamCallbacks.onFinish.push(options.onFinish);
    }

    if (options.onResponse) {
        streamCallbacks.onResponse.push(options.onResponse);
    }

    if (options.onCancel) {
        streamCallbacks.onCancel.push(options.onCancel);
    }

    if (options.onBeforeSend) {
        streamCallbacks.onBeforeSend.push(options.onBeforeSend);
    }

    return () => {
        removeCallbacks(id, options);
    };
};

const dispatchCallbacks = (
    id: string,
    callback: Callback,
    ...args: unknown[]
): any[] => {
    const streamCallbacks = callbacks.get(id);

    if (!streamCallbacks) {
        return [];
    }

    // @ts-expect-error Any args
    return streamCallbacks[callback].map((cb) => cb(...args));
};

export const onFinish = (id: string) => {
    dispatchCallbacks(id, "onFinish");
};

export const onError = (id: string, error: Error) => {
    dispatchCallbacks(id, "onError", error);
};

export const onResponse = (id: string, response: Response) => {
    dispatchCallbacks(id, "onResponse", response);
};

export const onCancel = (id: string) => {
    dispatchCallbacks(id, "onCancel");
};

export const onData = (id: string, data: string) => {
    dispatchCallbacks(id, "onData", data);
};

export const onBeforeSend = (id: string, request: RequestInit) => {
    const results = dispatchCallbacks(id, "onBeforeSend", request) as (
        | boolean
        | RequestInit
        | void
    )[];

    for (const result of results) {
        if (result === false) {
            return false;
        }

        if (result !== null && typeof result === "object") {
            return result;
        }
    }

    return null;
};

export const removeCallbacks = (id: string, options: StreamOptions) => {
    const streamCallbacks = callbacks.get(id);

    if (!streamCallbacks) {
        return;
    }

    if (options.onData) {
        streamCallbacks.onData = streamCallbacks.onData.filter(
            (cb) => cb !== options.onData,
        );
    }

    if (options.onError) {
        streamCallbacks.onError = streamCallbacks.onError.filter(
            (cb) => cb !== options.onError,
        );
    }

    if (options.onFinish) {
        streamCallbacks.onFinish = streamCallbacks.onFinish.filter(
            (cb) => cb !== options.onFinish,
        );
    }

    if (options.onResponse) {
        streamCallbacks.onResponse = streamCallbacks.onResponse.filter(
            (cb) => cb !== options.onResponse,
        );
    }

    if (options.onCancel) {
        streamCallbacks.onCancel = streamCallbacks.onCancel.filter(
            (cb) => cb !== options.onCancel,
        );
    }

    if (options.onBeforeSend) {
        streamCallbacks.onBeforeSend = streamCallbacks.onBeforeSend.filter(
            (cb) => cb !== options.onBeforeSend,
        );
    }
};
