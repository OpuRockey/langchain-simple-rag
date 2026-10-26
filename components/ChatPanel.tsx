"use client";

import { FormEvent, useState } from "react";
import type { ChatResult } from "@/types";

export default function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ChatResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setStatus("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Question failed.");
      setResult(data as ChatResult);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Question failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Ask a question</h2>
      <form onSubmit={askQuestion} className="grid gap-3">
        <textarea
          className="w-full border rounded-md px-3 py-2"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does the document say about annual leave?"
          rows={3}
          required
        />
        <button
          disabled={busy}
          type="submit"
          className="w-fit bg-neutral-900 text-white rounded-md px-4 py-2 disabled:opacity-60"
        >
          {busy ? "Searching..." : "Ask"}
        </button>
      </form>
      {status && <p role="status" className="mt-3 text-sm text-red-700">{status}</p>}
      {result && (
        <div className="mt-4">
          <h3 className="font-semibold">Answer</h3>
          <div className="whitespace-pre-wrap leading-7 mt-1">{result.answer}</div>
          <h3 className="font-semibold mt-4">Retrieved sources</h3>
          {result.sources.length === 0 ? (
            <p className="text-sm text-neutral-500">No matching chunks found.</p>
          ) : (
            result.sources.map((item, index) => (
              <article key={item.id} className="py-3 border-t mt-2">
                <h4 className="font-medium">
                  Source {index + 1}: {item.source}
                </h4>
                <p className="text-sm whitespace-pre-wrap leading-6 mt-1">{item.content}</p>
                <small className="text-neutral-500">
                  Cosine distance: {item.distance.toFixed(4)}
                </small>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
