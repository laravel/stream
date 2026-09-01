import { describe, expect, it, vi } from "vitest";
import { readEventStream, StreamFrame } from "../src/streams/events";

const bodyOf = (
    chunks: string[],
    cancel?: () => void,
): ReadableStream<Uint8Array> =>
    new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(new TextEncoder().encode(chunk));
            }

            controller.close();
        },
        cancel,
    });

const framesOf = async (chunks: string[]): Promise<StreamFrame[]> => {
    const frames: StreamFrame[] = [];

    await readEventStream(bodyOf(chunks), (frame) => {
        frames.push(frame);

        return true;
    });

    return frames;
};

describe("readEventStream", () => {
    it("discards a frame that never reached its blank line", async () => {
        expect(await framesOf(["data: one\n\ndata: trunc"])).toEqual([
            { event: null, id: null, data: "one" },
        ]);
    });

    it("cancels the body when the handler stops reading", async () => {
        const cancel = vi.fn();

        // Left open, the way a server still writing after a terminator would
        // leave it. Without the cancel it streams into a body nobody reads...
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new TextEncoder().encode("data: one\n\n"));
            },
            cancel,
        });

        await readEventStream(body, () => false);

        expect(cancel).toHaveBeenCalled();
    });

    it("reads the fields of a frame", async () => {
        expect(
            await framesOf(["id: 7\nevent: update\ndata: hello\n\n"]),
        ).toEqual([{ event: "update", id: "7", data: "hello" }]);
    });

    it("joins multi-line data and skips comments and blank lines", async () => {
        expect(await framesOf([": ping\ndata: one\ndata: two\n\n"])).toEqual([
            { event: null, id: null, data: "one\ntwo" },
        ]);
    });

    it("strips only the single space after a field's colon", async () => {
        expect(await framesOf(["data:  padded \n\n"])).toEqual([
            { event: null, id: null, data: " padded " },
        ]);
    });

    it("reads a frame terminated with CRLF", async () => {
        expect(await framesOf(["event: update\r\ndata: one\r\n\r\n"])).toEqual([
            { event: "update", id: null, data: "one" },
        ]);
    });

    it("reads a CRLF pair split across two chunks", async () => {
        expect(
            await framesOf(["data: one\r", "\n\r\ndata: two\r\n\r\n"]),
        ).toEqual([
            { event: null, id: null, data: "one" },
            { event: null, id: null, data: "two" },
        ]);
    });

    it("carries the last event id forward to later frames", async () => {
        // The last event ID buffer belongs to the stream and is not reset when
        // an event is dispatched...
        expect(await framesOf(["id: 7\ndata: one\n\ndata: two\n\n"])).toEqual([
            { event: null, id: "7", data: "one" },
            { event: null, id: "7", data: "two" },
        ]);
    });

    it("takes the id from a frame that dispatches nothing", async () => {
        // The id is recorded before the frame is dropped for carrying no data...
        expect(await framesOf(["id: 7\n\ndata: one\n\n"])).toEqual([
            { event: null, id: "7", data: "one" },
        ]);
    });

    it("ignores an id containing a NULL", async () => {
        expect(
            await framesOf(["id: 7\n\nid: a\u0000b\ndata: one\n\n"]),
        ).toEqual([{ event: null, id: "7", data: "one" }]);
    });

    it("skips a frame that carries no data lines", async () => {
        expect(await framesOf(["event: ping\n\ndata: one\n\n"])).toEqual([
            { event: null, id: null, data: "one" },
        ]);
    });
});
