import { StreamListenerCallback, StreamMeta } from "../types";

const streams = new Map<string, StreamMeta<unknown>>();
const listeners = new Map<string, StreamListenerCallback[]>();

export const resolveStream = <TJsonData = null>(
    id: string,
): StreamMeta<TJsonData> => {
    const stream = streams.get(id) as StreamMeta<TJsonData> | undefined;

    if (stream) {
        return stream;
    }

    const newStream: StreamMeta<TJsonData> = {
        controller: new AbortController(),
        data: "",
        isFetching: false,
        isStreaming: false,
        jsonData: null as TJsonData,
    };

    streams.set(id, newStream);

    return newStream;
};

export const resolveListener = (id: string) => {
    if (!listeners.has(id)) {
        listeners.set(id, []);
    }

    return listeners.get(id)!;
};

export const hasListeners = (id: string) => {
    return listeners.has(id) && listeners.get(id)?.length;
};

export const addListener = (id: string, listener: StreamListenerCallback) => {
    resolveListener(id).push(listener);

    return () => {
        listeners.set(
            id,
            resolveListener(id).filter((l) => l !== listener),
        );

        if (!hasListeners(id)) {
            streams.delete(id);
            listeners.delete(id);
        }
    };
};

export const update = <TJsonData = null>(
    id: string,
    params: Partial<StreamMeta<TJsonData>>,
) => {
    streams.set(id, {
        ...resolveStream(id),
        ...params,
    });

    const updatedStream = resolveStream(id);

    listeners.get(id)?.forEach((listener) => listener(updatedStream));
};
