import multer from "multer";
import fs, { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import type { Request } from "express";
import { LocalFileUploadOptions, ProcessedMulterFile, ProcessFieldsParams, ProcessFileParams, ProcessFilesParams, ProcessMulterUploadParams, UploadedFieldResult } from "../../interface";
import { BadRequestException } from "../../exception/app.exception.js";
import { StorageApproachEnum } from "../enum/multer.enum.js";
import { tmpdir } from "node:os";

export const fileTypeValidation = {
    image: ["image/jpeg", "image/png", "image/gif", "image/jpg"],
    files: ["application/json", "application/pdf"],
} as const;


export const localFileUpload = ({
        maxFileSize = 5 * 1024 * 1024,
        storageApproach=StorageApproachEnum.memory
    }: LocalFileUploadOptions = {}) => {
    const storage =storageApproach==StorageApproachEnum.memory? multer.memoryStorage():multer.diskStorage({
        destination(req,file,cb){
            cb(null,tmpdir())
        },
        filename(req,file,cb){
            cb(null,randomUUID()+file.originalname)
        }
    })
    const upload = multer({
        storage,
        limits: {
            fileSize: maxFileSize,
        },
    });
    return upload;
};

export const processFile = async ({
        validation = [],
        customPath = "general",
        file,
    }: ProcessFileParams = {}): Promise<ProcessedMulterFile> => {

    if (!file || !file.buffer) {
        throw new BadRequestException("File buffer is missing" );
    }

    if(file.path){
        file.buffer=await readFile(file.path)
    }

    const pathFolder = `uploads/${customPath}`;
    // await fs.mkdir(pathFolder, { recursive: true });

    const result = await fileTypeFromBuffer(file.buffer);

    if (!result || !validation.includes(result.mime)) {
        await unlink(file.path)
        throw new BadRequestException("Invalid file format" );
    }

    // const uniqueFilePath = `${pathFolder}/${randomUUID()}.${result.ext}`;
    // await fs.writeFile(resolve(uniqueFilePath), file.buffer);
    if(file.path)
        await unlink(file.path)
    // file.finalPath = uniqueFilePath;
    return file;
};

export const processFiles = async ({
        validation = [],
        customPath = "general",
        files = [],
    }: ProcessFilesParams = {}): Promise<string[]> => {
    const uploaded: string[] = [];

    for (const file of files) {
        const upload = await processFile({
            validation,
            customPath,
            file,
        });
        if (upload.finalPath) {
            uploaded.push(upload.finalPath);
        }
    }

    return uploaded;
};

export const processFields = async ({
        validation = [],
        customPath = "general",
        fields = {},
    }: ProcessFieldsParams = {}): Promise<UploadedFieldResult[]> => {
    const uploaded: UploadedFieldResult[] = [];

    for (const field of Object.keys(fields)) {
        const uploads = await processFiles({
            validation,
            customPath,
            files: fields[field]
        });
        uploaded.push({ field, uploads });
    }

    return uploaded;
};

export const processMulterUpload = async ({
        req,
        validation = [],
        customPath = "general",
    }: ProcessMulterUploadParams): Promise<void> => {
    if (req.file) {
        const processed = await processFile({
            validation,
            customPath,
            file: req.file,
        });
        req.filePath = processed.finalPath!;
    } else if (Array.isArray(req.files)) {
        const returnedFiles = await processFiles({
            validation,
            customPath,
            files: req.files,
        });
        req.filesPaths = returnedFiles;
    } else if (
        req.files &&
        typeof req.files === "object" &&
        Object.keys(req.files).length > 0
    ) {
        const returnedFiles = await processFields({
            validation,
            customPath,
            fields: req.files,
        });
        req.filesPaths = returnedFiles;
    }
};