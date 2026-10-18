/** Host of an absolute URL (`https://uu.nou.edu.tw/x` → `uu.nou.edu.tw`), or null. */
export function hostOf(url: string): string | null {
    const match = /^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i.exec(url);

    return match ? match[1] : null;
}
