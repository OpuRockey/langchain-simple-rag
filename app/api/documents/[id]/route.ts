import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/rag-service";


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "A document id is required." },
        { status: 400 },
      );
    }
    await deleteDocument(id);
    return NextResponse.json({ message: "Document deleted.", id });
  } catch (error) {
    console.error("Document deletion failed:", error);
    return NextResponse.json(
      { error: "Failed to delete the document." },
      { status: 500 },
    );
  }
}
