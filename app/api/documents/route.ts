import { NextResponse } from "next/server";
import { ingestText, listDocuments } from "@/lib/rag-service";

export async function GET() {
  try {
    const documents = await listDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to list documents:", error);
    return NextResponse.json(
      { error: "Failed to list documents." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("source" in body) ||
      !("content" in body) ||
      typeof body.source !== "string" ||
      typeof body.content !== "string"
    ) {
      return NextResponse.json(
        { error: "Provide a source title and document content." },
        { status: 400 },
      );
    }

    const source = body.source.trim();
    const content = body.content.trim();

    if (!source || !content) {
      return NextResponse.json(
        { error: "The title and content cannot be empty." },
        { status: 400 },
      );
    }

    if (content.length > 200_000) {
      return NextResponse.json(
        { error: "Document content exceeds the 200,000-character limit." },
        { status: 413 },
      );
    }

    const result = await ingestText(source, content, "text");

    return NextResponse.json({
      message: "Document ingested successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Document ingestion failed:", error);
    return NextResponse.json(
      { error: "Failed to ingest the document." },
      { status: 500 },
    );
  }
}

