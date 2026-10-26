import { NextResponse } from "next/server";
import { ingestFiles, type IncomingFile } from "@/lib/rag-service";

const MAX_FILES = 10;
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const entries = form.getAll("files");
    const files = entries.filter(
      (entry): entry is File => entry instanceof File,
    );

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files were uploaded." },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Upload at most ${MAX_FILES} files at once.` },
        { status: 400 },
      );
    }

    const incoming: IncomingFile[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the 15 MB limit.` },
          { status: 413 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      incoming.push({ fileName: file.name, buffer, size: file.size });
    }

    const { results, errors } = await ingestFiles(incoming);
    const status = errors.length > 0 && results.length > 0 ? 207 : errors.length > 0 ? 400 : 200;

    return NextResponse.json(
      {
        message:
          results.length > 0
            ? `Ingested ${results.length} file(s).`
            : "No files could be ingested.",
        results,
        errors,
      },
      { status },
    );
  } catch (error) {
    console.error("File upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process uploaded files." },
      { status: 500 },
    );
  }
}

