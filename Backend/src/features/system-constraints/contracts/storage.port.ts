export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StorageUploadResult {
  fileName: string;
  url: string;
}

export interface StoragePort {
  /**
   * Validates an image before any application state is changed.
   */
  assertValidImageUpload(file: Express.Multer.File): void;

  /**
   * Uploads a validated image to a server-controlled storage path.
   * @param file The file to upload (Multer file object)
   * @param path Optional directory path within the storage bucket
   */
  upload(file: Express.Multer.File, path?: string): Promise<StorageUploadResult>;

  /**
   * Deletes a file from the storage provider
   * @param fileUrl The full URL or object name of the file to delete
   */
  deleteFile(fileUrl: string): Promise<void>;

  /**
   * Returns a short-lived URL for a private file reference.
   */
  getSignedPrivateUrl(fileReference: string): Promise<string>;
}
