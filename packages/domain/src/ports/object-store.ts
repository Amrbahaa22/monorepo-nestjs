export interface ObjectStore {
  presignedUploadUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ): Promise<string>;
  presignedDownloadUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ): Promise<string>;
}
