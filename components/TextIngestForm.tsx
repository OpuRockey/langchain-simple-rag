"use client";

import { FormEvent, useState } from "react";

export default function TextIngestForm({ onIngested }: { onIngested: () => void }) {
  const [source, setSource] = useState("company-handbook.txt");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ingestion failed.");
      setStatus(`Indexed ${data.chunksCreated} chunk(s) from ${data.source}.`);
      setContent("");
      onIngested();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ingestion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Add text</h2>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="font-medium text-sm" htmlFor="source">
          Document title
        </label>
        <input
          id="source"
          className="w-full border rounded-md px-3 py-2"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          required
        />
        <label className="font-medium text-sm" htmlFor="content">
          Document text
        </label>
        <textarea
          id="content"
          className="w-full border rounded-md px-3 py-2"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your document text here..."
          rows={6}
          required
        />
        <button
          disabled={busy}
          type="submit"
          className="w-fit bg-neutral-900 text-white rounded-md px-4 py-2 disabled:opacity-60"
        >
          {busy ? "Processing..." : "Index document"}
        </button>
      </form>
      {status && (
        <p role="status" className="mt-3 text-sm text-neutral-600">
          {status}
        </p>
      )}
    </section>
  );
}
