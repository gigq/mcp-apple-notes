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
   * Gets list of available accounts in Notes app
   * @returns Array of account names
   */
  async getAccounts(): Promise<string[]> {
    const script = `
      tell application "Notes"
        set accountList to {}
        repeat with anAccount in accounts
          set end of accountList to name of anAccount
        end repeat
        return accountList
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      throw new Error('Failed to get accounts');
    }

    return result.output
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);
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
    
    // Try a simpler approach first
    const script = `
      tell application "Notes"
        set newNote to make new note with properties {name:"${sanitizedTitle}", body:"${sanitizedContent}"}
        return "created"
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      // Try with account specification
      const accountScript = `
        tell application "Notes"
          tell account "${sanitizedAccount}"
            set newNote to make new note with properties {name:"${sanitizedTitle}", body:"${sanitizedContent}"}
            return "created"
          end tell
        end tell
      `;
      
      const accountResult = await runAppleScript(accountScript);
      if (!accountResult.success) {
        // Don't expose internal error details
        throw new Error('Failed to create note');
      }
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
   * Searches for notes by content
   * @param query - The search query
   * @returns Array of matching notes
   */
  async searchNotes(query: string): Promise<Note[]> {
    const sanitizedQuery = sanitizeForAppleScript(query);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    
    // Use AppleScript's built-in "whose body contains" for efficient searching
    const script = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          set matchingNotes to notes whose body contains "${sanitizedQuery}"
          set resultList to {}
          
          repeat with currentNote in matchingNotes
            set noteName to name of currentNote
            set end of resultList to noteName
          end repeat
          
          return resultList
        end tell
      end tell
    `;

    const result = await runAppleScript(script);
    if (!result.success) {
      // Don't expose internal error details
      throw new Error('Failed to search notes');
    }

    if (!result.output || result.output.trim() === '') {
      return [];
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

  /**
   * Edits the content of an existing note
   * @param title - The exact title of the note to edit
   * @param newContent - The new content for the note
   * @returns Success status and the updated note
   */
  async editNote(title: string, newContent: string): Promise<{ success: boolean; note?: Note; error?: string }> {
    const sanitizedTitle = sanitizeForAppleScript(title);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    const formattedContent = formatContent(newContent);
    const sanitizedContent = sanitizeForAppleScript(formattedContent);
    
    // Update the note's body content using a more direct approach
    const editScript = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          set foundNote to false
          set noteList to every note
          repeat with aNote in noteList
            if name of aNote is "${sanitizedTitle}" then
              set body of aNote to "${sanitizedContent}"
              set foundNote to true
              exit repeat
            end if
          end repeat
          if foundNote then
            return "success"
          else
            return "not found"
          end if
        end tell
      end tell
    `;

    const editResult = await runAppleScript(editScript);
    if (!editResult.success) {
      return {
        success: false,
        error: 'Failed to update note'
      };
    }
    
    if (editResult.output === 'not found') {
      return {
        success: false,
        error: 'Note not found'
      };
    }

    return {
      success: true,
      note: {
        id: randomUUID(),
        title,
        content: newContent,
        tags: [],
        created: new Date(),
        modified: new Date()
      }
    };
  }

  /**
   * Deletes a note by title
   * @param title - The exact title of the note to delete
   * @returns Success status
   */
  async deleteNote(title: string): Promise<{ success: boolean; error?: string }> {
    const sanitizedTitle = sanitizeForAppleScript(title);
    const sanitizedAccount = sanitizeForAppleScript(this.accountName);
    
    // Delete the note using a more direct approach
    const deleteScript = `
      tell application "Notes"
        tell account "${sanitizedAccount}"
          set foundNote to false
          set noteList to every note
          repeat with aNote in noteList
            if name of aNote is "${sanitizedTitle}" then
              delete aNote
              set foundNote to true
              exit repeat
            end if
          end repeat
          if foundNote then
            return "success"
          else
            return "not found"
          end if
        end tell
      end tell
    `;

    const deleteResult = await runAppleScript(deleteScript);
    if (!deleteResult.success) {
      return {
        success: false,
        error: 'Failed to delete note'
      };
    }
    
    if (deleteResult.output === 'not found') {
      return {
        success: false,
        error: 'Note not found'
      };
    }

    return {
      success: true
    };
  }
}