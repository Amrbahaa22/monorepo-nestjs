import type { ObjectStore } from "@monorepo/domain";
import { BUCKETS, OBJECT_STORE } from "@monorepo/storage-kit";
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { kycObjectKey, statementObjectKey } from "./object-keys";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const KycUploadRequest = z.object({
  customerId: z.string().min(1),
  filename: z.string().min(1),
});

const StatementRequest = z.object({
  accountId: z.string().min(1),
  period: z.string().min(1),
});

@Controller("documents")
export class DocumentsController {
  constructor(@Inject(OBJECT_STORE) private readonly store: ObjectStore) {}

  /** Returns a URL the client uploads to directly; bytes never pass through here. */
  @Post("kyc/upload-url")
  async kycUploadUrl(@Body() body: unknown) {
    const parsed = KycUploadRequest.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const key = kycObjectKey(parsed.data.customerId, parsed.data.filename);
    const url = await this.store.presignedUploadUrl(
      BUCKETS.kycDocuments,
      key,
      UPLOAD_URL_TTL_SECONDS,
    );

    return { url, key, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  @Post("statements/download-url")
  async statementDownloadUrl(@Body() body: unknown) {
    const parsed = StatementRequest.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const key = statementObjectKey(parsed.data.accountId, parsed.data.period);
    const url = await this.store.presignedDownloadUrl(
      BUCKETS.statements,
      key,
      DOWNLOAD_URL_TTL_SECONDS,
    );

    return { url, key, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }
}
