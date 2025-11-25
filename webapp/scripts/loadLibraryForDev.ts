import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { LibrarySnapshot } from '../../../shared/library.ts';

/**
 * Helper to load the generated library for development
 * This can be used to seed KV or for local testing
 */
export async function loadGeneratedLibrary(): Promise<LibrarySnapshot> {
  const libraryPath = resolve(process.cwd(), 'data/library.generated.json');

  try {
    const fileContent = await readFile(libraryPath, 'utf-8');
    return JSON.parse(fileContent) as LibrarySnapshot;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(
        `Library file not found at ${libraryPath}. Run 'npm run sync:dropbox' first.`,
      );
    }
    throw error;
  }
}


