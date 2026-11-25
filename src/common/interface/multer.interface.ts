import { Request, RequestHandler } from "express";
import { StorageApproachEnum } from "../utils/enum";


export interface LocalFileUploadOptions {
    customPath?: string;
    customTypes?: string[];
    maxFileSize?: number;
    storageApproach?:StorageApproachEnum
}

export interface ProcessedMulterFile extends Express.Multer.File {
    finalPath?: string|undefined
}

export interface ProcessFileParams {
    validation?: readonly string[]|undefined
    customPath?: string|undefined
    file?: ProcessedMulterFile|undefined
}

export interface ProcessFilesParams {
    validation?: readonly string[]|undefined
    customPath?: string|undefined
    files?: ProcessedMulterFile[]|undefined
}

export interface ProcessFieldsParams {
    validation?: readonly string[]|undefined
    customPath?: string|undefined
    fields?: Record<string, ProcessedMulterFile[]>|undefined
}

export interface UploadedFieldResult {
    field: string;
    uploads: string[];
}

export interface MulterUploadRequest extends Request {
    file?: ProcessedMulterFile;
    files?:
        | ProcessedMulterFile[]
        | Record<string, ProcessedMulterFile[]>;
    filePath?: string;
    filesPaths?: string[] | UploadedFieldResult[];
}

export interface ProcessMulterUploadParams {
    req: Request;
    validation?: readonly string[];
    customPath?: string;
}

export interface UploadOptions {
    isRequired?: boolean | undefined;
    multerMiddleware: RequestHandler;
    validation?: readonly string[] | undefined;
    customPath?: string | undefined;
}