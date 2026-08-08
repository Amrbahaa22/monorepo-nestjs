# @monorepo/storage-kit

MinIO / S3 adapter implementing the domain `ObjectStore` port. Not implemented in this pass.

Scope when built:
- Versioned, object-locked bucket for KYC documents (retention is a compliance requirement)
- Separate bucket for generated statement PDFs
- Presigned upload/download URLs — the API never proxies file bytes
