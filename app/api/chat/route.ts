import { NextResponse } from "next/server";
import { askRag } from "@/lib/rag-graph";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("question" in body) ||
      typeof body.question !== "string"
    ) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 },
      );
    }

    const question = body.question.trim();

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 },
      );
    }

    if (question.length > 4_000) {
      return NextResponse.json(
        { error: "The question is too long." },
        { status: 413 },
      );
    }

    const result = await askRag(question);

    return NextResponse.json(result);
  } catch (error) {
    console.error("RAG query failed:", error);
    return NextResponse.json(
      { error: "Failed to answer the question." },
      { status: 500 },
    );
  }
}

