function randomId (length = 13) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' // Base58
    const buf = new Uint8Array(length)
    crypto.getRandomValues(buf)
    return Array.from(buf, x => alphabet[x % alphabet.length]).join('')
}

export default function useIds() {
    return {
        randomId
    }
}
