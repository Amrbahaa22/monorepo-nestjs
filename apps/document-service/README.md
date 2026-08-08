# document-service

KYC uploads and statement PDFs in MinIO. Not implemented in this pass.

## Responsibility
Issue presigned URLs for KYC document upload and statement PDF download.

## Constraints
- Implements the domain `ObjectStore` port (`packages/domain/src/ports/object-store.ts`) via
  `packages/platform/storage-kit`.
- KYC bucket is **versioned and object-locked**. Retention is a compliance requirement, not a
  configuration preference — documents cannot be deleted or overwritten within the retention window.
- Statement PDFs live in a **separate bucket** with its own lifecycle. Do not mix the two.
- Access is by presigned URL only. **The API never proxies file bytes** — no upload or download
  stream passes through this service.
