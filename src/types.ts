export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: Date;
  modified: Date;
}

export interface AppleScriptResult {
  success: boolean;
  output: string;
  error?: string;
}

// Parameters for MCP tool functions
export interface CreateNoteParams {
  title: string;
  content: string;
  tags?: string[];
}

export interface SearchParams {
  query: string;
}

export interface GetNoteParams {
  title: string;
}

export interface EditNoteParams {
  title: string;
  newContent: string;
}

export interface DeleteNoteParams {
  title: string;
}
