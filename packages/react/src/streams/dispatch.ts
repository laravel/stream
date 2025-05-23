import { RequiredCallbacks, StreamOptions } from "../types";

const callbacks = new Map<
    string,
    {
        onData: RequiredCallbacks["onData"][];
        onError: RequiredCallbacks["onError"][];
        onFinish: RequiredCallbacks["onFinish"][];
        onResponse: RequiredCallbacks["onResponse"][];
        onCancel: RequiredCallbacks["onCancel"][];
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

    return () => {
        removeCallbacks(id, options);
    };
};

const dispatchCallbacks = (
    id: string,
    callback: "onData" | "onError" | "onFinish" | "onResponse" | "onCancel",
    ...args: unknown[]
) => {
    const streamCallbacks = callbacks.get(id);

    if (!streamCallbacks) {
        return;
    }

    streamCallbacks[callback].forEach((cb) => {
        // @ts-expect-error Any args
        cb(...args);
    });
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
};
