import { randomUUID } from 'crypto';
import type { Note } from '@/types.js';
import { runAppleScript, sanitizeForAppleScript } from '@/utils/applescript.js';

/**
 * Formats note content for AppleScript compatibility
 * @param content - The raw note content
 * @returns Formatted content with proper line breaks
 */
const formatContent = (content: string): string => {
  if (!content) return '';

  // Replace newlines with HTML breaks for Apple Notes
  // The sanitization will handle escaping dangerous characters
  return content.replace(/\n/g, '<br>');
};

export class AppleNotesManager {
  private readonly accountName: string;

  constructor(accountName: string = "iCloud") {
    this.accountName = accountName;
  }

  /**
   * Creates a new note in Apple Notes
   * @param title - The note title
   * @param content - The note content
   * @param tags - Optional array of tags
   * @returns The created note object or null if creation fails
   */
  async createNote(title: string, content: string, tags: string[] = []): Promise<Note | null> {
    const sanitizedTitle = sanitizeForAppleScript(title);
    const formattedContent = formatContent(content);
    const sanitizedContent = sanitizeForAppleScript(formattedContent);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    
    const script = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          make new note with properties {name:"${sanitizedTitle}", body:"${sanitizedContent}"}
        end tell
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      // Don't expose internal error details
      throw new Error('Failed to create note');
    }

    return {
      id: randomUUID(),
      title,
      content,
      tags,
      created: new Date(),
      modified: new Date()
    };
  }

  /**
   * Searches for notes by title
   * @param query - The search query
   * @returns Array of matching notes
   */
  async searchNotes(query: string): Promise<Note[]> {
    const sanitizedQuery = sanitizeForAppleScript(query);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    
    const script = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          get name of notes where name contains "${sanitizedQuery}"
        end tell
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      // Don't expose internal error details
      throw new Error('Failed to search notes');
    }

    return result.output
      .split(',')
      .filter(Boolean)
      .map(title => ({
        id: randomUUID(),
        title: title.trim(),
        content: '',
        tags: [],
        created: new Date(),
        modified: new Date()
      }));
  }

  /**
   * Retrieves the content of a specific note
   * @param title - The exact title of the note
   * @returns The note content or empty string if not found
   */
  async getNoteContent(title: string): Promise<string> {
    const sanitizedTitle = sanitizeForAppleScript(title);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    
    const script = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          get body of note "${sanitizedTitle}"
        end tell
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      // Don't expose internal error details
      throw new Error('Failed to get note content');
    }

    return result.output;
  }
}