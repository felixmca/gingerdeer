"use client";

import { useState, useRef } from "react";

interface QueryResult {
  sql: string;
  results: Record<string, unknown>[] | null;
  columns: string[];
  error: string | null;
}

const SUGGESTED_QUERIES = [
  "Show all leads from this month",
  "What is the total pipeline MRR?",
  "List active subscriptions with user emails",
  "Count leads by CRM status",
  "Show contacts who haven't subscribed yet",
  "List all ingredients and their prices",
  "Show recent email activity (last 30 days)",
  "Which companies have the highest potential MRR?",
];

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export default function AiQuery() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data: QueryResult & { raw?: string } = await res.json();
      setResult({
        sql: data.sql ?? "",
        results: data.results,
        columns: data.columns ?? [],
        error: data.error ?? null,
      });
    } catch (err) {
      setResult({
        sql: "",
        results: null,
        columns: [],
        error: (err as Error).message ?? "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(q: string) {
    setQuestion(q);
    textareaRef.current?.focus();
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmit(question);
  }

  const hasResults = result?.results && result.results.length > 0;

  return (
    <div className="ai-query">
      {/* Page header */}
      <div className="ai-query__header">
        <div>
          <h1 className="ai-query__title">AI Query</h1>
          <p className="ai-query__sub">
            Ask a question in plain English — Claude generates SQL and runs it against
            your database.
          </p>
        </div>
        <div className="ai-query__badge">
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M7.5 1.5l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9L7.5 1.5z" />
            <path d="M12 9l.5 1.2 1.2.5-1.2.5L12 12.5l-.5-1.3-1.2-.5 1.2-.5L12 9z" />
          </svg>
          Powered by Claude
        </div>
      </div>

      {/* Suggested queries */}
      <div className="ai-query__suggestions">
        <span className="ai-query__suggestions-label">Try asking:</span>
        <div className="ai-query__chips">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              className="ai-chip"
              onClick={() => handleSuggestion(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleFormSubmit} className="ai-query__form">
        <div className="ai-query__input-wrap">
          <textarea
            ref={textareaRef}
            className="ai-query__textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How many leads converted this month? Show me the top 10 companies by pipeline MRR."
            rows={3}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(question);
              }
            }}
          />
          <div className="ai-query__input-footer">
            <span className="ai-query__hint">⌘ + Enter to run</span>
            <button
              type="submit"
              className="adm-btn adm-btn--primary"
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <>
                  <span className="adm-spinner adm-spinner--sm" />
                  Thinking&hellip;
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M13.5 7.5L1.5 1.5l3 6-3 6 12-6z" />
                  </svg>
                  Run Query
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="ai-query__result">
          {/* Generated SQL */}
          {result.sql && (
            <div className="ai-sql-block">
              <div className="ai-sql-block__header">
                <span className="ai-sql-block__label">Generated SQL</span>
                <button
                  type="button"
                  className="ai-sql-block__copy"
                  onClick={() => navigator.clipboard.writeText(result.sql)}
                  title="Copy SQL"
                >
                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <rect x="4" y="4" width="9" height="9" rx="1.5" />
                    <path d="M2 11V2h9" />
                  </svg>
                  Copy
                </button>
              </div>
              <pre className="ai-sql-block__code">{result.sql}</pre>
            </div>
          )}

          {/* Error state */}
          {result.error && (
            <div className="ai-query__error">
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="7.5" cy="7.5" r="6" />
                <path d="M7.5 5v3.5M7.5 10.5v.5" />
              </svg>
              <span>{result.error}</span>
              {result.error.includes("admin_exec_query") && (
                <p className="ai-query__error-hint">
                  Run the <code>admin_exec_query</code> function from{" "}
                  <code>supabase/schema.sql</code> in your Supabase SQL Editor to enable
                  query execution.
                </p>
              )}
            </div>
          )}

          {/* Results table */}
          {hasResults ? (
            <div className="ai-query__table-wrap">
              <div className="ai-query__table-meta">
                {result.results!.length} row{result.results!.length !== 1 ? "s" : ""}
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table ai-result-table">
                  <thead>
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.results!.map((row, i) => (
                      <tr key={i}>
                        {result.columns.map((col) => (
                          <td key={col} title={formatCellValue(row[col])}>
                            {formatCellValue(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !result.error && result.results !== null ? (
            <div className="adm-empty">
              <p className="adm-empty__title">Query returned 0 rows</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
