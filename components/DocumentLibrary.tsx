"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentItem } from "@/types";

export default function DocumentLibrary({ refreshKey }: { refreshKey: number }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load.");
      setDocuments(data.documents as DocumentItem[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold mb-4">Document library</h2>
      {status && <p className="text-sm text-red-700 mb-2">{status}</p>}
      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">No documents indexed yet.</p>
      ) : (
        <ul className="divide-y">
          {documents.map((doc) => (
            <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{doc.source}</p>
                <p className="text-xs text-neutral-500">
                  {doc.fileType} · {doc.chunkCount} chunk(s) ·{" "}
                  {(doc.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                  {new Date(doc.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                disabled={deleting === doc.id}
                onClick={() => remove(doc.id)}
                className="text-sm border rounded-md px-3 py-1.5 hover:bg-neutral-100 disabled:opacity-60"
              >
                {deleting === doc.id ? "Deleting..." : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
