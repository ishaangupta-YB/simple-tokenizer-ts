"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Vocabulary,
  trainBPE,
  encodeWithDetails,
  decode,
  DEFAULT_TRAINING_DATA,
} from "../lib/tokenizer";

// Token colors for visualization (similar to Tiktokenizer)
const TOKEN_COLORS = [
  { bg: "#ffedd5", text: "#9a3412" }, // orange
  { bg: "#fef3c7", text: "#92400e" }, // amber
  { bg: "#ecfccb", text: "#3f6212" }, // lime
  { bg: "#d1fae5", text: "#065f46" }, // emerald
  { bg: "#ccfbf1", text: "#0f766e" }, // teal
  { bg: "#cffafe", text: "#0e7490" }, // cyan
  { bg: "#dbeafe", text: "#1e40af" }, // blue
  { bg: "#e0e7ff", text: "#3730a3" }, // indigo
  { bg: "#ede9fe", text: "#5b21b6" }, // violet
  { bg: "#fae8ff", text: "#86198f" }, // fuchsia
  { bg: "#fce7f3", text: "#9d174d" }, // pink
  { bg: "#fee2e2", text: "#b91c1c" }, // red
];

export default function Home() {
  // Training state
  const [vocabSize, setVocabSize] = useState(350);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showWhitespace, setShowWhitespace] = useState(true);

  // Trained model state
  const [vocab, setVocab] = useState<Vocabulary | null>(null);
  const [merges, setMerges] = useState<Array<[string, string, string]>>([]);

  // Encoding state
  const [inputText, setInputText] = useState("Hello, world! 👋 Welcome to the BPE Tokenizer.");
  const [encodedTokens, setEncodedTokens] = useState<string[]>([]);
  const [encodedIds, setEncodedIds] = useState<number[]>([]);
  const [decodedText, setDecodedText] = useState("");

  // Auto-train on mount
  useEffect(() => {
    handleTrain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Train the tokenizer
  const handleTrain = useCallback(() => {
    setIsTraining(true);
    setTrainingProgress(0);

    setTimeout(() => {
      const targetMerges = vocabSize - 256;
      let stepCount = 0;

      const result = trainBPE(DEFAULT_TRAINING_DATA, vocabSize, () => {
        stepCount++;
        setTrainingProgress((stepCount / targetMerges) * 100);
      });

      setVocab(result.vocab);
      setMerges(result.merges);
      setIsTraining(false);
      setTrainingProgress(100);
    }, 50);
  }, [vocabSize]);

  // Auto-encode when input changes or vocab changes
  useEffect(() => {
    if (!vocab || !inputText) {
      setEncodedTokens([]);
      setEncodedIds([]);
      setDecodedText("");
      return;
    }

    try {
      const { ids, tokens } = encodeWithDetails(inputText, vocab, merges);
      setEncodedIds(ids);
      setEncodedTokens(tokens);
      setDecodedText(decode(ids, vocab));
    } catch (e) {
      console.error(e);
    }
  }, [vocab, merges, inputText]);

  // Format token for display
  const formatToken = useCallback((token: string, showWs: boolean) => {
    if (!showWs) return token;
    return token
      .replace(/ /g, "·")
      .replace(/\n/g, "↵\n")
      .replace(/\t/g, "→");
  }, []);

  // Compression ratio
  const compressionRatio = useMemo(() => {
    if (!encodedTokens.length || !inputText.length) return 0;
    return (inputText.length / encodedTokens.length).toFixed(2);
  }, [encodedTokens.length, inputText.length]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="logo">Tiktokenizer</h1>
          <p className="subtitle">BPE Tokenizer Visualizer</p>
        </div>
        <button 
          className="settings-toggle"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Toggle settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-content">
            <div className="setting-row">
              <label className="setting-label">Vocabulary Size</label>
              <div className="setting-control">
                <input
                  type="range"
                  min="270"
                  max="500"
                  value={vocabSize}
                  onChange={(e) => setVocabSize(parseInt(e.target.value))}
                  className="slider"
                />
                <span className="setting-value">{vocabSize}</span>
              </div>
            </div>
            <button
              className="train-button"
              onClick={handleTrain}
              disabled={isTraining}
            >
              {isTraining ? `Training... ${Math.round(trainingProgress)}%` : "Retrain Tokenizer"}
            </button>
            {isTraining && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${trainingProgress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="main">
        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Tokens</span>
            <span className="stat-value">{encodedTokens.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Characters</span>
            <span className="stat-value">{inputText.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Compression</span>
            <span className="stat-value">{compressionRatio}x</span>
          </div>
          <div className="stat">
            <span className="stat-label">Vocab Size</span>
            <span className="stat-value">{vocab?.size || 0}</span>
          </div>
          <div className="toggle-container">
            <label className="toggle">
              <input
                type="checkbox"
                checked={showWhitespace}
                onChange={(e) => setShowWhitespace(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">Show whitespace</span>
          </div>
        </div>

        {/* Input Section */}
        <div className="input-section">
          <label className="section-label">Content</label>
          <textarea
            className="text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or paste text here to tokenize..."
            rows={6}
          />
        </div>

        {/* Token Visualization */}
        <div className="tokens-section">
          <div className="section-header">
            <label className="section-label">Tokenized Output</label>
            {decodedText === inputText && encodedTokens.length > 0 && (
              <span className="match-badge">✓ Perfect decode</span>
            )}
          </div>
          
          {encodedTokens.length > 0 ? (
            <div className="tokens-display">
              {encodedTokens.map((token, i) => (
                <span
                  key={i}
                  className="token"
                  style={{
                    backgroundColor: TOKEN_COLORS[i % TOKEN_COLORS.length].bg,
                    color: TOKEN_COLORS[i % TOKEN_COLORS.length].text,
                  }}
                  title={`ID: ${encodedIds[i]} | Token: ${JSON.stringify(token)}`}
                >
                  {formatToken(token, showWhitespace)}
                </span>
              ))}
            </div>
          ) : (
            <div className="empty-tokens">
              {isTraining ? "Training tokenizer..." : "Type something above to see tokens"}
            </div>
          )}
        </div>

        {/* Token IDs Section */}
        {encodedIds.length > 0 && (
          <div className="ids-section">
            <label className="section-label">Token IDs</label>
            <div className="ids-display">
              [{encodedIds.join(", ")}]
            </div>
          </div>
        )}

        {/* Decoded Section */}
        {decodedText && (
          <div className="decoded-section">
            <label className="section-label">Decoded Text</label>
            <div className="decoded-display">
              {decodedText}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>Built from scratch in TypeScript • Inspired by <a href="https://tiktokenizer.vercel.app/" target="_blank" rel="noopener noreferrer">Tiktokenizer</a></p>
      </footer>
    </div>
  );
}
