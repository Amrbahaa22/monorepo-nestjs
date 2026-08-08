import {
  CreateBucketCommand,
  PutObjectLockConfigurationCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { BUCKET_POLICIES, type BucketPolicy } from "./buckets";

/**
 * Object lock can only be enabled at creation time, so a bucket that already
 * exists without it cannot be upgraded — it has to be recreated. That is why
 * this runs as an explicit provisioning step, not lazily on first write.
 */
export async function provisionBuckets(
  client: S3Client,
  policies: readonly BucketPolicy[] = BUCKET_POLICIES,
): Promise<string[]> {
  const created: string[] = [];

  for (const policy of policies) {
    try {
      await client.send(
        new CreateBucketCommand({
          Bucket: policy.name,
          ObjectLockEnabledForBucket: policy.objectLockYears !== null,
        }),
      );
      created.push(policy.name);
    } catch (error) {
      if (!isAlreadyOwned(error)) {
        throw error;
      }
    }

    if (policy.objectLockYears !== null) {
      await client.send(
        new PutObjectLockConfigurationCommand({
          Bucket: policy.name,
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: {
              DefaultRetention: {
                Mode: "COMPLIANCE",
                Years: policy.objectLockYears,
              },
            },
          },
        }),
      );
    }
  }

  return created;
}

function isAlreadyOwned(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  return name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists";
}
