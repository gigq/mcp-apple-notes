import { spawn } from 'child_process';
import type { AppleScriptResult } from '@/types.js';

/**
 * Executes an AppleScript command and returns the result
 * @param script - The AppleScript command to execute
 * @returns Object containing success status and output/error
 */
export function runAppleScript(script: string): Promise<AppleScriptResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    
    // Use spawn to avoid shell injection - script is passed as argument, not interpolated
    const child = spawn('osascript', ['-e', script], {
      timeout: 10000 // 10 second timeout
    });

    child.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    child.stderr.on('data', (chunk) => {
      errorChunks.push(chunk);
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        error: `Failed to execute AppleScript: ${error.message}`
      });
    });

    child.on('exit', (code) => {
      const output = Buffer.concat(chunks).toString('utf8').trim();
      const errorOutput = Buffer.concat(errorChunks).toString('utf8').trim();

      if (code === 0) {
        resolve({
          success: true,
          output
        });
      } else {
        resolve({
          success: false,
          output: '',
          error: errorOutput || `AppleScript exited with code ${code}`
        });
      }
    });
  });
}

/**
 * Sanitizes a string for safe use in AppleScript
 * Escapes special characters that could break AppleScript syntax
 */
export function sanitizeForAppleScript(input: string): string {
  if (!input) return '';
  
  // Escape backslashes first, then quotes and other special characters
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/'/g, "'\"'\"'") // Escape single quotes using concatenation
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t');  // Escape tabs
}