export type FileKind = "text" | "pdf" | "docx" | "txt" | "md";

export interface DocumentItem {
  id: string;
  source: string;
  fileType: FileKind;
  sizeBytes: number;
  chunkCount: number;
  createdAt: string;
}

export interface IngestResult {
  documentId: string;
  source: string;
  chunksCreated: number;
}

export interface UploadFileError {
  file: string;
  error: string;
}

export interface UploadResult {
  results: IngestResult[];
  errors: UploadFileError[];
}
