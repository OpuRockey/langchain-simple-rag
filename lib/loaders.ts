import "server-only";

export interface ParsedFile {
  fileName: string;
  text: string;
}

const SUPPORTED = new Set([".pdf", ".docx", ".txt", ".md"]);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function isSupported(fileName: string): boolean {
  return SUPPORTED.has(extensionOf(fileName));
}

export async function parseFileBuffer(
  fileName: string,
  buffer: Buffer,
): Promise<ParsedFile> {
  const ext = extensionOf(fileName);
  if (ext === ".pdf") {
    const { PDFLoader } = await import(
      "@langchain/community/document_loaders/fs/pdf"
    );
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    const loader = new PDFLoader(blob);
    const docs = await loader.load();
    return { fileName, text: docs.map((d) => d.pageContent).join("\n\n") };
  }
  if (ext === ".docx") {
    const { DocxLoader } = await import(
      "@langchain/community/document_loaders/fs/docx"
    );
    const blob = new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const loader = new DocxLoader(blob);
    const docs = await loader.load();
    return { fileName, text: docs.map((d) => d.pageContent).join("\n\n") };
  }
  if (ext === ".txt" || ext === ".md") {
    return { fileName, text: buffer.toString("utf-8") };
  }
  throw new Error(`Unsupported file type: ${ext || "(none)"}`);
}
