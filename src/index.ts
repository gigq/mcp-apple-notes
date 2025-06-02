import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AppleNotesManager } from "@/services/appleNotesManager.js";
import type { CreateNoteParams, SearchParams, GetNoteParams, EditNoteParams, DeleteNoteParams } from "@/types.js";

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
function checkRateLimit(toolName: string): void {
  const now = Date.now();
  const key = toolName;
  const limit = requestCounts.get(key);
  
  if (!limit || now > limit.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return;
  }
  
  if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  limit.count++;
}

// Initialize the MCP server
const server = new McpServer({
  name: "apple-notes",
  version: "1.0.0",
  description: "MCP server for interacting with Apple Notes"
});

// Configuration
const accountName = process.env.APPLE_NOTES_ACCOUNT || "iCloud";
const maxTitleLength = 255;
const maxContentLength = 50000;
const maxTagLength = 50;
const maxTags = 20;

// Initialize the notes manager
const notesManager = new AppleNotesManager(accountName);

// Define tool schemas with stricter validation
const createNoteSchema = {
  title: z.string()
    .min(1, "Title is required")
    .max(maxTitleLength, `Title must be ${maxTitleLength} characters or less`)
    .regex(/^[^<>:"|?*\x00-\x1F]+$/, "Title contains invalid characters"),
  content: z.string()
    .min(1, "Content is required")
    .max(maxContentLength, `Content must be ${maxContentLength} characters or less`),
  tags: z.array(
    z.string()
      .max(maxTagLength, `Tag must be ${maxTagLength} characters or less`)
      .regex(/^[\w\s\-]+$/, "Tags can only contain letters, numbers, spaces, and hyphens")
  ).max(maxTags, `Maximum ${maxTags} tags allowed`).optional()
};

const searchSchema = {
  query: z.string()
    .min(1, "Search query is required")
    .max(100, "Search query must be 100 characters or less")
    .regex(/^[^<>:"|?*\x00-\x1F]+$/, "Search query contains invalid characters")
};

const getNoteSchema = {
  title: z.string()
    .min(1, "Note title is required")
    .max(maxTitleLength, `Title must be ${maxTitleLength} characters or less`)
    .regex(/^[^<>:"|?*\x00-\x1F]+$/, "Title contains invalid characters")
};

const editNoteSchema = {
  title: z.string()
    .min(1, "Note title is required")
    .max(maxTitleLength, `Title must be ${maxTitleLength} characters or less`)
    .regex(/^[^<>:"|?*\x00-\x1F]+$/, "Title contains invalid characters"),
  newContent: z.string()
    .min(1, "New content is required")
    .max(maxContentLength, `Content must be ${maxContentLength} characters or less`)
};

const deleteNoteSchema = {
  title: z.string()
    .min(1, "Note title is required")
    .max(maxTitleLength, `Title must be ${maxTitleLength} characters or less`)
    .regex(/^[^<>:"|?*\x00-\x1F]+$/, "Title contains invalid characters")
};

// Register tools
server.tool(
  "create-note",
  createNoteSchema,
  async ({ title, content, tags = [] }: CreateNoteParams) => {
    try {
      checkRateLimit("create-note");
      
      const note = await notesManager.createNote(title, content, tags);
      if (!note) {
        return {
          content: [{
            type: "text",
            text: "Failed to create note"
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ Note created successfully: "${note.title}"`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error instanceof Error && error.message.includes('Rate limit') 
            ? error.message 
            : 'Failed to create note'
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "search-notes",
  searchSchema,
  async ({ query }: SearchParams) => {
    try {
      checkRateLimit("search-notes");
      
      const notes = await notesManager.searchNotes(query);
      const message = notes.length
        ? `Found ${notes.length} notes:\n${notes.map(note => `• ${note.title}`).join('\n')}`
        : "No notes found matching your query";

      return {
        content: [{
          type: "text",
          text: message
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error instanceof Error && error.message.includes('Rate limit') 
            ? error.message 
            : 'Failed to search notes'
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "get-note-content",
  getNoteSchema,
  async ({ title }: GetNoteParams) => {
    try {
      checkRateLimit("get-note-content");
      
      const content = await notesManager.getNoteContent(title);
      return {
        content: [{
          type: "text",
          text: content || "Note not found"
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error instanceof Error && error.message.includes('Rate limit') 
            ? error.message 
            : 'Failed to retrieve note'
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "edit-note",
  editNoteSchema,
  async ({ title, newContent }: EditNoteParams) => {
    try {
      checkRateLimit("edit-note");
      
      const result = await notesManager.editNote(title, newContent);
      
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: result.error || "Failed to edit note"
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ Note "${title}" has been updated successfully`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error instanceof Error && error.message.includes('Rate limit') 
            ? error.message 
            : 'Failed to edit note'
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "delete-note",
  deleteNoteSchema,
  async ({ title }: DeleteNoteParams) => {
    try {
      checkRateLimit("delete-note");
      
      const result = await notesManager.deleteNote(title);
      
      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: result.error || "Failed to delete note"
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ Note "${title}" has been deleted successfully`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error instanceof Error && error.message.includes('Rate limit') 
            ? error.message 
            : 'Failed to delete note'
        }],
        isError: true
      };
    }
  }
);

// Debug tool to list accounts
server.tool(
  "list-accounts",
  {},
  async () => {
    try {
      const accounts = await notesManager.getAccounts();
      return {
        content: [{
          type: "text",
          text: `Available accounts: ${accounts.join(', ')}\nCurrent account: ${accountName}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: 'Failed to list accounts'
        }],
        isError: true
      };
    }
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);