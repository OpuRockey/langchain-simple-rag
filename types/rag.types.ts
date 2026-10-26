export interface RetrievedSource {
  id: string;
  source: string;
  content: string;
  distance: number;
}

export interface ChatResult {
  answer: string;
  sources: RetrievedSource[];
}

export interface RAGState {
  question: string;
  context: string;
  sources: RetrievedSource[];
  answer: string;
}
