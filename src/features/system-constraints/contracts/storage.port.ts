export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StorageUploadResult {
  fileName: string;
  url: string;
}

export interface StoragePort {
  /**
   * Uploads a file to the storage provider
   * @param file The file to upload (Multer file object)
   * @param originalName The original filename
   * @param path Optional directory path within the storage bucket
   */
  upload(
    file: Express.Multer.File,
    originalName: string,
    path?: string,
  ): Promise<StorageUploadResult>;

  /**
   * Deletes a file from the storage provider
   * @param fileUrl The full URL or object name of the file to delete
   */
  deleteFile(fileUrl: string): Promise<void>;
}
