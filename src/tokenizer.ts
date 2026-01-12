class Vocabulary {
    private tokenToId: Map<string, number>;
    private idToToken: Map<number, string>;

    constructor() {
        this.tokenToId = new Map();
        this.idToToken = new Map();
    }
    addToken(token: string): number {
        if (this.tokenToId.has(token)) {
            return this.tokenToId.get(token)!;
        }
        const id = this.tokenToId.size;
        this.tokenToId.set(token, id);
        this.idToToken.set(id, token);
        return id;
    }
    getId(token: string): number | undefined {
        return this.tokenToId.get(token);
    }
    getToken(id: number): string | undefined {
        return this.idToToken.get(id);
    }
    get Size(): number {
        return this.tokenToId.size;
    }
}


function textToBytes(text: string): number[] {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
}

function bytesToText(bytes: number[]): string {
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes));
}

function textToByteTokens(text: string): string[] {
    const bytes = textToBytes(text);
    const tokens = [];
    for (const byte of bytes) {
        if (byte >= 32 && byte < 127) {
            tokens.push(String.fromCharCode(byte));
        } else {
            tokens.push(`<0x${byte.toString(16).padStart(2, '0')}>`);
        }
    }
    return tokens;
}

function countPairs(tokens: string[]): Map<string, number> {
    const pairCounts = new Map<string, number>();
    for (let i = 0; i < tokens.length - 1; i++) {
        const key = tokens[i] + tokens[i + 1];
        const value = pairCounts.get(key) || 0;
        pairCounts.set(key, value + 1);
    }
    return pairCounts;
}





// testing the textToBytes and bytesToText functions

// console.log(textToBytes("Hello, world!"));
// // prints [72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 33]
// console.log(bytesToText([72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 33]));
// // prints "Hello, world!"


// testing the vocabulary class
// const vocabulary = new Vocabulary();
// console.log(vocabulary.addToken("Hello"));
// console.log(vocabulary.addToken("world"));
// console.log(vocabulary.addToken("hello"));

// console.log(vocabulary.Size);

// console.log(vocabulary.getId("Hello"));
// console.log(vocabulary.getId("world"));
// console.log(vocabulary.getId("abc"));
// console.log(vocabulary.getToken(0));
// console.log(vocabulary.getToken(1));
// console.log(vocabulary.getToken(99));
// console.log(vocabulary.getToken(vocabulary.Size-1));


// testing the textToByteTokens function

// console.log(textToByteTokens("Hi"));        // ["H", "i"]
// console.log(textToByteTokens("Hi\n"));      // ["H", "i", "<0x0a>"]
// console.log(textToByteTokens("A B"));       // ["A", " ", "B"]
// console.log(textToByteTokens("世"));         // ["<0xe4>", "<0xb8>", "<0x96>"]


// testing the countPairs function

console.log(countPairs(["a", "b", "c"]));
// Map { "a,b" => 1, "b,c" => 1 }
console.log(countPairs(["l", "o", "w", " ", "l", "o", "w"]));
// Map { "l,o" => 2, "o,w" => 2, "w, " => 1, " ,l" => 1 }
console.log(countPairs(["a"]));