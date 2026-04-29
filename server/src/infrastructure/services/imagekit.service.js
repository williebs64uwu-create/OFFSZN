import ImageKit from "@imagekit/nodejs";
import { IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } from '../../shared/config/config.js';

// Initialize ImageKit with Private Key (Public Key and Endpoint are used in helpers)
const imagekit = new ImageKit({
    privateKey: IMAGEKIT_PRIVATE_KEY
});

/**
 * Uploads an image to ImageKit.
 * @param {string|Buffer} file - Base64 string, Buffer, or Stream.
 * @param {string} fileName - File name.
 * @param {string} folder - Destination folder (e.g., 'avatars', 'banners').
 * @returns {Promise<Object>} - Upload result from ImageKit.
 */
export const uploadToImageKit = async (file, fileName, folder = 'uploads') => {
    try {
        const response = await imagekit.files.upload({
            file: file,
            fileName: fileName,
            folder: folder,
            useUniqueFileName: true
        });
        return response;
    } catch (error) {
        console.error("❌ [ImageKit Service] Upload Error:", error);
        throw error;
    }
};

/**
 * Generates a transformed URL for an image.
 * @param {string} path - Path to the image in ImageKit (e.g., '/avatars/my_id.jpg').
 * @param {Array} transformations - ImageKit transformation options array.
 * @returns {string} - Transformed URL.
 */
export const getTransformedUrl = (path, transformations = []) => {
    return imagekit.helper.buildSrc({
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        src: path,
        transformation: transformations
    });
};

/**
 * Deletes an image from ImageKit by its path.
 * @param {string} filePath - The path to the file in ImageKit (e.g., '/reels/my_reel.mp4').
 */
export const deleteFromImageKitByPath = async (filePath) => {
    try {
        const searchPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        
        // Extract folder and filename from the path
        // e.g., /avatars/avatar_xxx_RspRVFvcw -> folder: avatars, name: avatar_xxx_RspRVFvcw
        const lastSlash = searchPath.lastIndexOf('/');
        const folder = lastSlash > 0 ? searchPath.substring(1, lastSlash) : '';
        const fileName = lastSlash >= 0 ? searchPath.substring(lastSlash + 1) : searchPath.replace(/^\//, '');
        
        if (!fileName) {
            console.warn(`⚠️ [ImageKit] Could not extract filename from path: ${searchPath}`);
            return;
        }

        // Use searchQuery (Lucene-like syntax) — the only reliable way to find files
        // When searchQuery is present, other params like `name` and `path` are ignored per docs
        let query = `name="${fileName}"`;
        if (folder) {
            // filePath in ImageKit includes the leading slash
            query += ` AND filePath="/${folder}/"`;
        }

        let files = await imagekit.assets.list({ searchQuery: query });

        // Fallback: search by name only (in case folder path format differs)
        if ((!files || files.length === 0) && folder) {
            files = await imagekit.assets.list({ searchQuery: `name="${fileName}"` });
        }

        if (files && files.length > 0) {
            const fileId = files[0].fileId;
            await imagekit.files.delete(fileId);
            console.log(`🗑️ [ImageKit] Deleted "${fileName}" from /${folder} (ID: ${fileId})`);
        } else {
            // Not an error — file may have been already deleted or never existed
            console.warn(`⚠️ [ImageKit] No file found: ${fileName} in /${folder} (already cleaned?)`);
        }
    } catch (error) {
        // Don't throw — cleanup failures shouldn't crash the app
        console.error("❌ [ImageKit Service] Delete By Path Error:", error?.message || error);
    }
};

export default imagekit;
