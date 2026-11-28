import {
    CompleteMultipartUploadOutput,
    DeleteObjectCommand,
    DeleteObjectCommandOutput,
    DeleteObjectsCommand,
    DeleteObjectsCommandOutput,
    GetObjectCommand,
    GetObjectCommandOutput,
    ListObjectsV2Command,
    ListObjectsV2CommandOutput,
    ObjectCannedACL,
    PutObjectCommand,
    S3Client,
    } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import {
    AWS_ACCESS_KEY,
    AWS_BUCKET_NAME,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
} from "../../config/config.service";
import { BadRequestException } from "../exception/app.exception.js";

export class CloudService {
    private readonly cloudClient: S3Client;
    private readonly basePrefix = "social_app";

    constructor() {
        this.cloudClient = new S3Client({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        });
    }

    private buildKey(path: string, fileName: string): string {
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        return `${this.basePrefix}/${path}/${randomUUID()}__${safeName}`;
    }

    async uploadAsset({
        Bucket = AWS_BUCKET_NAME,
        ACL = ObjectCannedACL.private,
        file,
        path = "general",
    }: {
        Bucket?: string;
        ACL?: ObjectCannedACL;
        file: Express.Multer.File;
        path?: string;
    }): Promise<string> {
        const key = this.buildKey(path, file.originalname);
        const command = new PutObjectCommand({
            Bucket,
            Key: key,
            Body: file.buffer,
            ACL,
            ContentType: file.mimetype,
        });

        await this.cloudClient.send(command);
        return key;
    }

    async uploadLargeAsset({
        Bucket = AWS_BUCKET_NAME,
        ACL = ObjectCannedACL.private,
        file,
        path = "general",
    }: {
        Bucket?: string;
        ACL?: ObjectCannedACL;
        file: Express.Multer.File;
        path?: string;
    }): Promise<CompleteMultipartUploadOutput> {
        const key = this.buildKey(path, file.originalname);
        const upload = new Upload({
            client: this.cloudClient,
            params: {
                Bucket,
                Key: key,
                Body: file.buffer,
                ACL,
                ContentType: file.mimetype,
            },
            partSize: 5 * 1024 * 1024,
        });

        return await upload.done();
    }

    async uploadAssets({
        Bucket = AWS_BUCKET_NAME,
        ACL = ObjectCannedACL.private,
        files,
        path = "general",
    }: {
        Bucket?: string;
        ACL?: ObjectCannedACL;
        files: Express.Multer.File[];
        path?: string;
    }): Promise<string[]> {
        return await Promise.all(
            files.map((file) => this.uploadAsset({ Bucket, ACL, file, path }))
        );
    }

    async getAsset({
        Bucket = AWS_BUCKET_NAME,
        Key,
    }: {
        Bucket?: string;
        Key: string;
    }): Promise<GetObjectCommandOutput> {
        const command = new GetObjectCommand({ Bucket, Key });
        return await this.cloudClient.send(command);
    }

    async listFolderDirs({
        Bucket = AWS_BUCKET_NAME,
        Prefix,
    }: {
        Bucket?: string;
        Prefix: string;
    }): Promise<ListObjectsV2CommandOutput> {
        const command = new ListObjectsV2Command({
            Bucket,
            Prefix: `${this.basePrefix}/${Prefix}`,
        });
        return await this.cloudClient.send(command);
    }

    async deleteAsset({
        Bucket = AWS_BUCKET_NAME,
        Key,
    }: {
        Bucket?: string;
        Key: string;
    }): Promise<DeleteObjectCommandOutput> {
        const command = new DeleteObjectCommand({ Bucket, Key });
        return await this.cloudClient.send(command);
    }

    async deleteAssets({
        Bucket = AWS_BUCKET_NAME,
        Keys,
    }: {
        Bucket?: string;
        Keys: string[];
    }): Promise<DeleteObjectsCommandOutput> {
        if (Keys.length === 0) {
            throw new BadRequestException("No keys provided for deletion");
        }

        const command = new DeleteObjectsCommand({
            Bucket,
            Delete: {
                Objects: Keys.map((Key) => ({ Key })),
                Quiet: false,
            },
        });
        return await this.cloudClient.send(command);
    }

    async deleteFolderByPrefix({
        Bucket = AWS_BUCKET_NAME,
        Prefix,
    }: {
        Bucket?: string;
        Prefix: string;
    }): Promise<DeleteObjectsCommandOutput[]> {
        const listResponse = await this.listFolderDirs({ Bucket, Prefix });
        const keys =
            listResponse.Contents?.map((obj) => obj.Key).filter((k): k is string => Boolean(k)) ?? [];

        if (keys.length === 0) {
            throw new BadRequestException("No files found in the specified folder");
        }

        const results: DeleteObjectsCommandOutput[] = [];
        for (let i = 0; i < keys.length; i += 1000) {
            const batch = keys.slice(i, i + 1000);
            results.push(await this.deleteAssets({ Bucket, Keys: batch }));
        }

        return results;
    }

    async createPreSignedUrl({
        path,
        ContentType,
        expiresIn = 3600,
        fileName,
        Bucket = AWS_BUCKET_NAME,
    }: {
        Bucket?: string;
        path: string;
        ContentType: string;
        fileName: string;
        expiresIn?: number;
    }): Promise<{ url: string; Key: string }> {
        const Key = this.buildKey(path, fileName);
        const command = new PutObjectCommand({
            Bucket,
            Key,
            ContentType,
        });
        const url = await getSignedUrl(this.cloudClient, command, { expiresIn });
        return { url, Key };
    }

    async getPreSignedUrl({
        Key,
        expiresIn = 3600,
        Bucket = AWS_BUCKET_NAME,
        download = false,
    }: {
        Bucket?: string;
        Key: string;
        expiresIn?: number;
        download?: boolean;
    }): Promise<string> {
        const rawName = Key.split("/").pop() || "file";
        const safeName = rawName.replace(/["\\]/g, "_");
        const command = new GetObjectCommand({
            Bucket,
            Key,
            ResponseContentDisposition: download
                ? `attachment; filename="${safeName}"`
                : undefined,
        });
        return await getSignedUrl(this.cloudClient, command, { expiresIn });
    }
}

export const cloudInstance = new CloudService();