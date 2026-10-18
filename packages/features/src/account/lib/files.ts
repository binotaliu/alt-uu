import { saveFile } from '@altuu/attachment-bridge';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

/** Sub-directory of the app cache the attachment bridge downloads into. */
const ATTACHMENT_CACHE_DIRECTORY = 'attachments';

/** Writes `contents` to the app cache and returns the `file://` URI. */
export async function writeCacheTextFile(
    fileName: string,
    contents: string,
): Promise<string> {
    const file = new File(Paths.cache, fileName);

    file.create({ overwrite: true });
    await file.write(contents);

    return file.uri;
}

/**
 * Hands a cache file to the system save dialog. Resolves false when the user
 * dismissed the dialog.
 */
export async function saveTextFile(
    fileName: string,
    contents: string,
    mimeType: string,
): Promise<boolean> {
    const uri = await writeCacheTextFile(fileName, contents);
    const result = await saveFile(uri, fileName, mimeType);

    return result.saved;
}

/** Lets the user pick a JSON file and returns its text, or null when cancelled. */
export async function pickJsonFileText(): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
    });
    const asset = result.canceled ? undefined : result.assets[0];

    if (asset === undefined) {
        return null;
    }

    return new File(asset.uri).text();
}

function countFiles(directory: Directory): number {
    return directory
        .list()
        .reduce(
            (total, entry) =>
                total + (entry instanceof Directory ? countFiles(entry) : 1),
            0,
        );
}

/** Deletes every downloaded attachment (legacy "清除已下載附件"). */
export async function clearDownloadedAttachments(): Promise<{
    deletedFiles: number;
}> {
    const directory = new Directory(Paths.cache, ATTACHMENT_CACHE_DIRECTORY);

    if (!directory.exists) {
        return { deletedFiles: 0 };
    }

    const deletedFiles = countFiles(directory);
    directory.delete();

    return { deletedFiles };
}
