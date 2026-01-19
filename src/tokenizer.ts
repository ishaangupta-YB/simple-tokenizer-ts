import * as fs from 'fs';
import * as path from 'path';

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
        const key = tokens[i] + '\0' + tokens[i + 1];
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
    return pairCounts;
}

function getMostFrequentPairs(pairCounts: Map<string, number>): [string, string, number] | null {
    let mostFrequentPair: [string, string, number] | null = null;
    if (pairCounts.size === 0) return null;
    for (const [key, value] of pairCounts.entries()) {
        if (mostFrequentPair === null || value > mostFrequentPair[2]) {
            mostFrequentPair = [key.split('\0')[0], key.split('\0')[1], value];
        }
    }
    return mostFrequentPair;
}


function mergePairs(tokens: string[], token1: string, token2: string, merged: string): string[] {
    const newTokens = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === token1 && tokens[i + 1] === token2) {
            newTokens.push(merged);
            i++;
        } else {
            newTokens.push(tokens[i]);
        }
    }
    return newTokens;
}

function intializeByteVocab(vocab: Vocabulary): void {
    for (let i = 0; i < 256; i++) {
        let token: string;
        if (i >= 32 && i < 127) {
            token = String.fromCharCode(i);
        } else {
            token = `<0x${i.toString(16).padStart(2, '0')}>`;
        }
        vocab.addToken(token);
    }
    console.log(`Byte vocabulary initialized with ${vocab.Size} tokens`);
}

function tokenToBytes(token: string): number[] {
    // Handles merged tokens that may contain:
    // - Multiple hex byte tokens: "<0xe4><0xbd>"
    // - Mixed content: "e<0x0a>" or "<0x0a>e"
    // - Pure ASCII: "low"
    
    const bytes: number[] = [];
    let i = 0;
    
    while (i < token.length) {
        // Check if we're at the start of a hex byte token <0xXX>
        // Format is exactly 6 chars: <0x + 2 hex digits + >
        if (
            i + 5 < token.length &&
            token.slice(i, i + 3) === '<0x' &&
            token[i + 5] === '>'
        ) {
            const hex = token.slice(i + 3, i + 5);
            bytes.push(parseInt(hex, 16));
            i += 6; // Skip past "<0xXX>"
        } else {
            // Regular ASCII character
            bytes.push(token.charCodeAt(i));
            i++;
        }
    }
    
    return bytes;
}

function trainBPE(text: string, targetVocabularySize: number): { vocab: Vocabulary, merges: Array<[string, string, string]> } {
    const vocab = new Vocabulary();
    const merges: Array<[string, string, string]> = [];

    intializeByteVocab(vocab);
    console.log(`Initial vocab size: ${vocab.Size}`);
    let tokens = textToByteTokens(text);

    console.log(`Target vocab size: ${targetVocabularySize}`);

    while (vocab.Size < targetVocabularySize) {
        const pairCounts = countPairs(tokens);
        const mostFrequentPair = getMostFrequentPairs(pairCounts);
        if (mostFrequentPair === null) break;
        const [token1, token2, count] = mostFrequentPair;
        const merged = token1 + token2;
        vocab.addToken(merged);
        merges.push([token1, token2, merged]);
        tokens = mergePairs(tokens, token1, token2, merged);
        console.log(`Merged ${token1} and ${token2} to ${merged}`);
        console.log(`New vocab size: ${vocab.Size}`);
        console.log(`New tokens: ${tokens.join(' ')}`);
    }

    console.log(`Final vocab size: ${vocab.Size}`);
    console.log(`Learned ${merges.length} merge rules`);

    return { vocab, merges };
}

function encode(text: string, vocab: Vocabulary, merges: Array<[string, string, string]>): number[] {
    let tokens = textToByteTokens(text);

    for (const [token1, token2, merged] of merges) {
        tokens = mergePairs(tokens, token1, token2, merged);
    }
    const ids: number[] = [];
    for (const token of tokens) {
        const id = vocab.getId(token);
        if (id === undefined) {
            throw new Error(`Token ${token} not found in vocabulary`);
        }
        ids.push(id);
    }
    return ids;
}

function decode(ids: number[], vocab: Vocabulary): string {
    const tokens: string[] = [];
    for(const id of ids) {
        const token = vocab.getToken(id);
        if(token === undefined) {
            throw new Error(`ID ${id} not found in vocabulary`);
        }
        tokens.push(token);
    }
    const bytes: number[] = [];
    for (const token of tokens) {
        bytes.push(...tokenToBytes(token));
    }
    return bytesToText(bytes);
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

// console.log(countPairs(["a", "b", "c"]));
// // Map { "a,b" => 1, "b,c" => 1 }
// console.log(countPairs(["l", "o", "w", " ", "l", "o", "w"]));
// // Map { "l,o" => 2, "o,w" => 2, "w, " => 1, " ,l" => 1 }
// console.log(countPairs(["a"]));




// testing the getMostFrequentPairs function

// const pairs1 = countPairs(["l", "o", "w", " ", "l", "o", "w"]);
// console.log(getMostFrequentPairs(pairs1));
// // ["l", "o", 2] or ["o", "w", 2] (either is fine, both have count 2)

// const pairs2 = countPairs(["a", "b", "c"]);
// console.log(getMostFrequentPairs(pairs2));
// // ["a", "b", 1] or ["b", "c", 1]

// const pairs3 = countPairs(["a"]);
// console.log(getMostFrequentPairs(pairs3));



// testing the mergePairs function
// console.log(mergePairs(["l", "o", "w", " ", "l", "o", "w"], "l", "o", "lo"));
// // ["lo", "w", " ", "lo", "w"]

// console.log(mergePairs(["a", "b", "a", "b", "a", "b"], "a", "b", "ab"));
// // ["ab", "ab", "ab"]

// console.log(mergePairs(["a", "a", "a"], "a", "a", "aa"));
// // ["aa", "a"]  (first two merge, third is left alone)

// console.log(mergePairs(["x", "y", "z"], "a", "b", "ab"));
// // ["x", "y", "z"]  (no matches, unchanged)


// const result = trainBPE("low low lower lowest", 15);
// console.log("Merge rules:", result.merges);
// console.log("Vocabulary:", result.vocab);



// ============================================
// FINAL TEST: Train on real data.txt
// ============================================

console.log("=".repeat(50));
console.log("TRAINING TOKENIZER ON data.txt");
console.log("=".repeat(50));

// Load training data
const dataPath = path.join(__dirname, '..', 'data.txt');
const trainingData = fs.readFileSync(dataPath, 'utf-8');
console.log(`\nLoaded ${trainingData.length} characters of training data\n`);

// Train with vocabulary size of 500 (256 base bytes + 244 merges)
const { vocab, merges } = trainBPE(trainingData, 500);

console.log("\n" + "=".repeat(50));
console.log("TESTING ENCODE/DECODE");
console.log("=".repeat(50));

// Test with various inputs
const testTexts = [
    "Hello, world!",
    "tokenization",
    "machine learning",
    "The quick brown fox",
    "function hello() { return 42; }",
    "你好世界",
    "cafe",
    "ishaan gupta"
];

for (const text of testTexts) {
    const encoded = encode(text, vocab, merges);
    const decoded = decode(encoded, vocab);
    const match = text === decoded ? "✓" : "✗";
    console.log(`\n"${text}"`);
    console.log(`  Tokens: ${encoded.length} | IDs: [${encoded.slice(0, 8).join(', ')}${encoded.length > 8 ? ', ...' : ''}]`);
    console.log(`  Decoded: "${decoded}" ${match}`);
}
