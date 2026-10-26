"use client";

import { useState } from "react";
import TextIngestForm from "@/components/TextIngestForm";
import FileUploadForm from "@/components/FileUploadForm";
import DocumentLibrary from "@/components/DocumentLibrary";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Simple RAG</h1>
        <p className="text-neutral-600">
          Index your own text and files, then ask questions about their content.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <TextIngestForm onIngested={refresh} />
        <FileUploadForm onIngested={refresh} />
      </div>
      <div className="grid gap-5 mt-5">
        <DocumentLibrary refreshKey={refreshKey} />
        <ChatPanel />
      </div>
    </main>
  );
}
