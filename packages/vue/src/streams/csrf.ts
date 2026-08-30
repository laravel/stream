export type CsrfHeaderOptions = {
    csrfToken?: string;
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
};

export const csrfHeaders = ({
    csrfToken,
    xsrfCookieName = "XSRF-TOKEN",
    xsrfHeaderName = "X-XSRF-TOKEN",
}: CsrfHeaderOptions = {}): Record<string, string> => {
    if (csrfToken) {
        return { "X-CSRF-TOKEN": csrfToken };
    }

    if (typeof document === "undefined") {
        return {};
    }

    const meta = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");

    if (meta) {
        return { "X-CSRF-TOKEN": meta };
    }

    // Laravel sets an XSRF-TOKEN cookie on every session response, so an
    // application rendering no csrf-token meta tag can still post.
    const prefix = `${xsrfCookieName}=`;

    const cookie = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(prefix));

    if (!cookie) {
        return {};
    }

    // Laravel encrypts the cookie and Symfony percent-encodes it on the way
    // out, so the value has to be decoded before it goes back as a header.
    return {
        [xsrfHeaderName]: decodeURIComponent(cookie.slice(prefix.length)),
    };
};
