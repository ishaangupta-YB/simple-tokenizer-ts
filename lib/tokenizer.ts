/**
 * BPE Tokenizer - Browser Compatible Version
 * This is the same tokenizer logic, but without Node.js dependencies (fs, path)
 */

export class Vocabulary {
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

  get size(): number {
    return this.tokenToId.size;
  }

  getAllTokens(): Array<{ token: string; id: number }> {
    return Array.from(this.tokenToId.entries()).map(([token, id]) => ({
      token,
      id,
    }));
  }
}

export function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

export function bytesToText(bytes: number[]): string {
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}

export function textToByteTokens(text: string): string[] {
  const bytes = textToBytes(text);
  const tokens: string[] = [];
  for (const byte of bytes) {
    if (byte >= 32 && byte < 127) {
      tokens.push(String.fromCharCode(byte));
    } else {
      tokens.push(`<0x${byte.toString(16).padStart(2, "0")}>`);
    }
  }
  return tokens;
}

export function countPairs(tokens: string[]): Map<string, number> {
  const pairCounts = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i] + "\0" + tokens[i + 1];
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  return pairCounts;
}

export function getMostFrequentPair(
  pairCounts: Map<string, number>
): [string, string, number] | null {
  let mostFrequentPair: [string, string, number] | null = null;
  if (pairCounts.size === 0) return null;
  for (const [key, value] of pairCounts.entries()) {
    if (mostFrequentPair === null || value > mostFrequentPair[2]) {
      mostFrequentPair = [key.split("\0")[0], key.split("\0")[1], value];
    }
  }
  return mostFrequentPair;
}

export function mergePairs(
  tokens: string[],
  token1: string,
  token2: string,
  merged: string
): string[] {
  const newTokens: string[] = [];
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

export function initializeByteVocab(vocab: Vocabulary): void {
  for (let i = 0; i < 256; i++) {
    let token: string;
    if (i >= 32 && i < 127) {
      token = String.fromCharCode(i);
    } else {
      token = `<0x${i.toString(16).padStart(2, "0")}>`;
    }
    vocab.addToken(token);
  }
}

export function tokenToBytes(token: string): number[] {
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
      token.slice(i, i + 3) === "<0x" &&
      token[i + 5] === ">"
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

export type MergeStep = {
  step: number;
  pair: [string, string];
  merged: string;
  frequency: number;
  vocabSize: number;
  tokens: string[];
};

export type TrainingResult = {
  vocab: Vocabulary;
  merges: Array<[string, string, string]>;
  steps: MergeStep[];
};

export function trainBPE(
  text: string,
  targetVocabSize: number,
  onStep?: (step: MergeStep) => void
): TrainingResult {
  const vocab = new Vocabulary();
  const merges: Array<[string, string, string]> = [];
  const steps: MergeStep[] = [];

  initializeByteVocab(vocab);
  let tokens = textToByteTokens(text);

  let stepNum = 0;
  while (vocab.size < targetVocabSize) {
    const pairCounts = countPairs(tokens);
    const mostFrequentPair = getMostFrequentPair(pairCounts);
    if (mostFrequentPair === null) break;

    const [token1, token2, count] = mostFrequentPair;
    const merged = token1 + token2;
    vocab.addToken(merged);
    merges.push([token1, token2, merged]);
    tokens = mergePairs(tokens, token1, token2, merged);

    stepNum++;
    const step: MergeStep = {
      step: stepNum,
      pair: [token1, token2],
      merged,
      frequency: count,
      vocabSize: vocab.size,
      tokens: [...tokens],
    };
    steps.push(step);

    if (onStep) {
      onStep(step);
    }
  }

  return { vocab, merges, steps };
}

export function encode(
  text: string,
  vocab: Vocabulary,
  merges: Array<[string, string, string]>
): number[] {
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

export function encodeWithDetails(
  text: string,
  vocab: Vocabulary,
  merges: Array<[string, string, string]>
): { ids: number[]; tokens: string[] } {
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
  return { ids, tokens };
}

export function decode(ids: number[], vocab: Vocabulary): string {
  const tokens: string[] = [];
  for (const id of ids) {
    const token = vocab.getToken(id);
    if (token === undefined) {
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

// Default training data for the demo (content from data.txt)
export const DEFAULT_TRAINING_DATA = `In 2026, José said: "Hello, 世界! 👋🚀" while debugging const π = 3.14159; at 03:45 AM.
His café bill was €12.50 (₹1045.75), uptime = 99.99%, latency ≤ 10 ms.
Meanwhile العربية تُكتب من اليمين ← اليسار, हिंदी भी यहाँ है, and emojis like 🤖✨🔥 coexist with math ∑x², arrows → ⇄, and URLs such as https://example.com?q=テスト#α.
Final check: naïve façade coöperate — does it tokenize correctly? ✅

The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.
Programming languages like Python, JavaScript, TypeScript, and Rust are widely used today.
Machine learning models require tokenization to process natural language text effectively.

Tokenization is the process of breaking down text into smaller units called tokens.
These tokens can be words, subwords, or even individual characters depending on the approach.
Byte Pair Encoding (BPE) is one of the most popular subword tokenization algorithms.
It works by iteratively merging the most frequent pairs of characters or character sequences.

The transformer architecture, introduced in the paper "Attention Is All You Need", revolutionized NLP.
Large language models like GPT-4, Claude, and LLaMA use subword tokenization for efficiency.
The vocabulary size is typically between 30,000 and 100,000 tokens for modern LLMs.

Common words like "the", "and", "is", "to", "of", "a", "in", "that", "it", "for" appear frequently.
Less common words get split into subwords: "tokenization" might become "token" + "ization".
This approach handles out-of-vocabulary words gracefully without needing a special unknown token.

Special characters and punctuation: !@#$%^&*()_+-=[]{}|;':",.<>?/\`~
Numbers and dates: 1234567890, January 11th 2026, 3.14159265359, -273.15°C
Code snippets: function hello() { return "world"; } const x = (a, b) => a + b;

Different languages contribute to vocabulary diversity:
French: Bonjour, comment allez-vous? Je m'appelle Claude.
German: Guten Tag, wie geht es Ihnen? Maschinelles Lernen ist faszinierend.
Spanish: Hola, ¿cómo estás? El procesamiento del lenguaje natural es interesante.
Japanese: こんにちは、お元気ですか？自然言語処理は面白いです。
Chinese: 你好，你好吗？自然语言处理非常有趣。
Korean: 안녕하세요, 어떻게 지내세요? 자연어 처리는 흥미롭습니다.

Technical terms frequently used in AI and ML:
neural network, deep learning, gradient descent, backpropagation, attention mechanism
transformer, encoder, decoder, embedding, positional encoding, layer normalization
training, inference, fine-tuning, pre-training, loss function, optimizer, learning rate
batch size, epoch, overfitting, underfitting, regularization, dropout, activation function

Programming concepts and keywords:
function, class, interface, type, const, let, var, return, if, else, for, while, do
import, export, async, await, promise, callback, closure, prototype, inheritance
array, object, string, number, boolean, null, undefined, symbol, bigint, map, set

Common English words for better tokenization:
the, be, to, of, and, a, in, that, have, I, it, for, not, on, with, he, as, you, do, at
this, but, his, by, from, they, we, say, her, she, or, an, will, my, one, all, would, there
their, what, so, up, out, if, about, who, get, which, go, me, when, make, can, like, time
no, just, him, know, take, people, into, year, your, good, some, could, them, see, other

Repeated patterns help BPE learn common sequences:
the the the and and and is is is to to to of of of
ing ing ing tion tion tion ed ed ed ly ly ly er er er
un un un re re re pre pre pre dis dis dis

Mathematical and scientific notation:
E = mc², F = ma, PV = nRT, ∫f(x)dx, ∂y/∂x, ∇·E = ρ/ε₀
sin(θ), cos(θ), tan(θ), log(x), ln(x), exp(x), √x, x², x³, xⁿ
∑(n=1 to ∞), ∏(i=1 to n), lim(x→0), ∞, ≤, ≥, ≠, ≈, ∝, ∈, ∉, ⊂, ⊃, ∪, ∩

URLs, emails, and paths:
https://www.example.com/path/to/resource?query=value&other=123#section
user@example.com, admin@company.org, test.user@subdomain.example.co.uk
/home/user/documents/file.txt, C:\\Users\\Name\\Documents\\file.docx
./relative/path, ../parent/path, ~/home/path

JSON and data formats:
{"name": "tokenizer", "version": "1.0.0", "tokens": [1, 2, 3, 4, 5]}
<html><head><title>Page</title></head><body><p>Content</p></body></html>
key: value, list: [item1, item2, item3], nested: {inner: data}

Edge cases and special handling:
Words with apostrophes: don't, won't, can't, it's, I'm, you're, they're, we've, I've
Hyphenated words: state-of-the-art, well-known, self-driving, machine-learning
Contractions and abbreviations: Dr., Mr., Mrs., Ms., Jr., Sr., etc., e.g., i.e., vs.
Acronyms: NASA, FBI, CIA, HTML, CSS, JSON, API, REST, GPU, CPU, RAM, SSD

Numbers in various formats:
1, 10, 100, 1000, 10000, 100000, 1000000
1.5, 2.75, 3.14159, 0.001, 99.99
1st, 2nd, 3rd, 4th, 5th, 10th, 21st, 22nd, 23rd
50%, 100%, 0.5%, 99.9%
$10, $100.00, €50, £75, ¥1000, ₹500

This diverse corpus helps train a robust tokenizer that can handle:
- Multiple languages and scripts
- Technical terminology
- Programming code
- Mathematical notation
- Special characters and symbols
- Numbers and dates
- URLs and file paths
- Common patterns and rare words`;
