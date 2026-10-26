"use client";

import { FormEvent, useState } from "react";
import type { UploadResult } from "@/types";

export default function FileUploadForm({ onIngested }: { onIngested: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      setStatus("Select at least one file.");
      return;
    }
    setBusy(true);
    setStatus("");
    setDetail(null);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as UploadResult & {
        error?: string;
        message?: string;
      };
      if (!response.ok && !data.results) {
        throw new Error(data.error ?? "Upload failed.");
      }
      setDetail({ results: data.results ?? [], errors: data.errors ?? [] });
      setStatus(
        data.message ??
          `Ingested ${(data.results ?? []).length} file(s).`,
      );
      setFiles([]);
      onIngested();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Upload files</h2>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />
        {files.length > 0 && (
          <ul className="text-sm text-neutral-600 list-disc pl-5">
            {files.map((f) => (
              <li key={f.name}>
                {f.name} ({(f.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        )}
        <button
          disabled={busy}
          type="submit"
          className="w-fit bg-neutral-900 text-white rounded-md px-4 py-2 disabled:opacity-60"
        >
          {busy ? "Uploading..." : `Upload ${files.length || ""} file(s)`.trim()}
        </button>
      </form>
      {status && (
        <p role="status" className="mt-3 text-sm text-neutral-600">
          {status}
        </p>
      )}
      {detail && detail.errors.length > 0 && (
        <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
          {detail.errors.map((e) => (
            <li key={e.file}>
              {e.file}: {e.error}
            </li>
          ))}
        </ul>
      )}
      {detail && detail.results.length > 0 && (
        <ul className="mt-2 text-sm text-green-800 list-disc pl-5">
          {detail.results.map((r) => (
            <li key={r.documentId}>
              {r.source}: {r.chunksCreated} chunk(s)
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
