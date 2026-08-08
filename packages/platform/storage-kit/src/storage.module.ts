import { S3Client } from "@aws-sdk/client-s3";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { S3ObjectStore } from "./s3-object-store";

export const S3_CLIENT = Symbol("S3_CLIENT");
export const OBJECT_STORE = Symbol("OBJECT_STORE");

@Global()
@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: S3_CLIENT,
          // Resolved at DI time, never in a decorator argument.
          useFactory: () =>
            new S3Client({
              endpoint: `http://${process.env.MINIO_ENDPOINT ?? "localhost"}:${process.env.MINIO_PORT ?? "9000"}`,
              region: process.env.MINIO_REGION ?? "us-east-1",
              forcePathStyle: true,
              credentials: {
                accessKeyId: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
                secretAccessKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
              },
            }),
        },
        {
          provide: OBJECT_STORE,
          inject: [S3_CLIENT],
          useFactory: (client: S3Client) => new S3ObjectStore(client),
        },
      ],
      exports: [S3_CLIENT, OBJECT_STORE],
    };
  }
}
