import { CompleteMultipartUploadOutput, DeleteObjectCommand, DeleteObjectCommandOutput, DeleteObjectsCommand, GetObjectAttributesRequest$, GetObjectCommand, GetObjectCommandOutput, ListObjectsV2Command, ListObjectsV2CommandOutput, ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AWS_ACCESS_KEY, AWS_BUCKET_NAME, AWS_REGION, AWS_SECRET_ACCESS_KEY } from "../../config/config.service";
import { BadRequestException } from "../exception/app.exception.js";
import { Upload } from "@aws-sdk/lib-storage";


export class CloudService{
    private cloudClient:S3Client
    constructor(){
        this.cloudClient = new S3Client({
            region:AWS_REGION,
            credentials:{
                accessKeyId:AWS_ACCESS_KEY,
                secretAccessKey:AWS_SECRET_ACCESS_KEY
            }
        });
    }

    async uploadAsset({
        Bucket=AWS_BUCKET_NAME,
        ACL=ObjectCannedACL.private,
        file,
        path="general"
    }: {
        Bucket?: string,
        ACL?: ObjectCannedACL,
        file: Express.Multer.File,
        path?: string
    }): Promise<string>{
        const key=`social_app/${path}/${file.originalname}`
        const command=new PutObjectCommand({
            Bucket:Bucket,
            Key:key,
            Body:file.buffer,
            ACL
        });
        const response=await this.cloudClient.send(command);
        if(!command.input.Key)
            throw new BadRequestException("File upload failed");
        return key;
    }

    async uploadLargeAsset({
        Bucket=AWS_BUCKET_NAME,
        ACL=ObjectCannedACL.private,
        file,
        path="general"
    }: {
        Bucket?: string,
        ACL?: ObjectCannedACL,
        file: Express.Multer.File,
        path?: string
    }): Promise<CompleteMultipartUploadOutput>{
        const key=`social_app/${path}/${file.originalname}`
        const upload=new Upload({
            client:this.cloudClient,
            params:{
                Bucket:Bucket,
                Key:key,
                Body:file.buffer,
                ACL
            },
            partSize: 5 * 1024 * 1024
        });
        return await upload.done();
    }

    async uploadAssets({
        Bucket=AWS_BUCKET_NAME,
        ACL=ObjectCannedACL.private,
        files,
        path="general"
    }: {
        Bucket?: string,
        ACL?: ObjectCannedACL,
        files: Express.Multer.File[],
        path?: string
    }): Promise<string[]>{
        let keys:string[]=[]
        // for(const file of files){
        //     const key=await this.uploadAsset({Bucket,ACL,file,path})
        //     keys.push(key)
        // }
        keys=await Promise.all(files.map(async (file)=>{
            const key=await this.uploadAsset({Bucket,ACL,file,path})
            return key
        }))
        return keys
    }

    async getAsset({
        Bucket=AWS_BUCKET_NAME,
        Key
    }: {
        Bucket?: string,
        Key: string
    }): Promise<GetObjectCommandOutput>{
        const command=new GetObjectCommand({
            Bucket:Bucket,
            Key:Key
        });
        const response=await this.cloudClient.send(command);
        return response;
    }

    async deleteAsset({
        Bucket=AWS_BUCKET_NAME,
        Key
    }: {
        Bucket?: string,
        Key: string
    }): Promise<DeleteObjectCommandOutput>{
        const command=new DeleteObjectCommand({
            Bucket:Bucket,
            Key:Key
        });
        return await this.cloudClient.send(command);
    }

    async deleteAssets({
        Bucket=AWS_BUCKET_NAME,
        Keys
    }: {
        Bucket?: string,
        Keys: string[]
    }): Promise<DeleteObjectCommandOutput>{
        const command=new DeleteObjectsCommand({
            Bucket:Bucket,
            Delete: {
                Objects: Keys.map((k) => ({ Key: k }))
            }
        });
        return await this.cloudClient.send(command);
    }

    async listFolderDirs({
        Bucket=AWS_BUCKET_NAME,
        Prefix
    }: {
        Bucket?: string,
        Prefix: string
    }): Promise<ListObjectsV2CommandOutput>{
        const command=new ListObjectsV2Command({
            Bucket:Bucket,
            Prefix:`social_app/${Prefix}`
        });
        return await this.cloudClient.send(command);
    }

    async deleteFolderByPrefix({
        Bucket=AWS_BUCKET_NAME,
        Prefix
    }: {
        Bucket?: string,
        Prefix: string
    }): Promise<DeleteObjectCommandOutput>{
        const listResponse=await this.listFolderDirs({Bucket,Prefix})
        if(!listResponse.Contents || listResponse.Contents.length===0)
            throw new BadRequestException("No files found in the specified folder");

        const keys=listResponse.Contents.map((obj)=>obj.Key!) || []
        return await this.deleteAssets({Bucket,Keys:keys})
    }
}

export const cloudInstance=new CloudService()