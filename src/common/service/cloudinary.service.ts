import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
} from "../../config/config.service";
import { BadRequestException } from "../exception/app.exception.js";

type CloudinaryResourceType = "image" | "video" | "raw" | "auto";
type CloudinaryDeliveryType = "upload" | "private" | "authenticated";

export class CloudService {
    private cloudClient: typeof cloudinary;

    constructor() {
        cloudinary.config({
            cloud_name: CLOUDINARY_CLOUD_NAME,
            api_key: CLOUDINARY_API_KEY,
            api_secret: CLOUDINARY_API_SECRET,
        });
        this.cloudClient = cloudinary;
    }

    private buildFolder(path = "general"): string {
        return `social_app/${path}`.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
    }

    private uploadBuffer(
        buffer: Buffer,
        options: Record<string, unknown>
    ): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
        const stream = this.cloudClient.uploader.upload_stream(
            options,
            (error, result) => {
            if (error || !result) {
                return reject(
                error ?? new BadRequestException("File upload failed")
                );
            }
            resolve(result);
            }
        );
        stream.end(buffer);
        });
    }

    async uploadAsset({
        type = "upload",
        resource_type = "auto",
        file,
        path = "general",
    }: {
        type?: CloudinaryDeliveryType;
        resource_type?: CloudinaryResourceType;
        file: Express.Multer.File;
        path?: string;
    }): Promise<string> {
            const folder = this.buildFolder(path);
            const result = await this.uploadBuffer(file.buffer, {
            folder,
            resource_type,
            type,
            use_filename: true,
            unique_filename: true,
        });

        if (!result.public_id) {
        throw new BadRequestException("File upload failed");
        }

        return result.public_id;
    }

    async uploadLargeAsset({
        type = "upload",
        resource_type = "auto",
        file,
        path = "general",
        chunk_size = 5 * 1024 * 1024,
    }: {
        type?: CloudinaryDeliveryType;
        resource_type?: CloudinaryResourceType;
        file: Express.Multer.File;
        path?: string;
        chunk_size?: number;
    }): Promise<UploadApiResponse> {
            const folder = this.buildFolder(path);
            return await this.uploadBuffer(file.buffer, {
            folder,
            resource_type,
            type,
            chunk_size,
            use_filename: true,
            unique_filename: true,
        });
    }

    async uploadAssets({
        type = "upload",
        resource_type = "auto",
        files,
        path = "general",
    }: {
        type?: CloudinaryDeliveryType;
        resource_type?: CloudinaryResourceType;
        files: Express.Multer.File[];
        path?: string;
    }): Promise<string[]> {
            return await Promise.all(
            files.map((file) =>
                this.uploadAsset({ type, resource_type, file, path })
            )
        );
    }

    getAssetUrl({
        publicId,
        resource_type = "image",
        type = "upload",
        signed = false,
        expiresAt,
    }: {
        publicId: string;
        resource_type?: Exclude<CloudinaryResourceType, "auto">;
        type?: CloudinaryDeliveryType;
        signed?: boolean;
        expiresAt?: number;
    }): string {
            if (signed || type !== "upload") {
            return this.cloudClient.utils.private_download_url(publicId, "", {
                resource_type,
                type,
                ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
            });
        }

        return this.cloudClient.url(publicId, {
        resource_type,
        type,
        secure: true,
        });
    }

    async deleteAsset({
        publicId,
        resource_type = "image",
        type = "upload",
        invalidate = true,
    }: {
        publicId: string;
        resource_type?: Exclude<CloudinaryResourceType, "auto">;
        type?: CloudinaryDeliveryType;
        invalidate?: boolean;
    }) {
            return await this.cloudClient.uploader.destroy(publicId, {
            resource_type,
            type,
            invalidate,
        });
    }

    async deleteAssets({
        publicIds,
        resource_type = "image",
        type = "upload",
        invalidate = true,
    }: {
        publicIds: string[];
        resource_type?: Exclude<CloudinaryResourceType, "auto">;
        type?: CloudinaryDeliveryType;
        invalidate?: boolean;
    }) {
            return await this.cloudClient.api.delete_resources(publicIds, {
            resource_type,
            type,
            invalidate,
        });
    }

    async listFolderDirs({
        Prefix,
        resource_type = "image",
        max_results = 100,
    }: {
        Prefix: string;
        resource_type?: Exclude<CloudinaryResourceType, "auto">;
        max_results?: number;
    }) {
            const prefix = this.buildFolder(Prefix);
            return await this.cloudClient.api.resources({
            type: "upload",
            resource_type,
            prefix,
            max_results,
        });
    }

    async deleteFolderByPrefix({
        Prefix,
        resource_type = "image",
        type = "upload",
        invalidate = true,
    }: {
        Prefix: string;
        resource_type?: Exclude<CloudinaryResourceType, "auto">;
        type?: CloudinaryDeliveryType;
        invalidate?: boolean;
    }) {
            const prefix = this.buildFolder(Prefix);
            const listResponse = await this.listFolderDirs({
            Prefix,
            resource_type,
        });

        if (!listResponse.resources || listResponse.resources.length === 0) {
        throw new BadRequestException("No files found in the specified folder");
        }

            return await this.cloudClient.api.delete_resources_by_prefix(prefix, {
            resource_type,
            type,
            invalidate,
        });
    }
}

export const cloudInstance = new CloudService();