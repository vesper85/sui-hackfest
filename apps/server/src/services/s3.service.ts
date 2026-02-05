import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/env";
import type { S3PresignedUrlParams, UploadResult } from "../types";

class S3Service {
    private client: S3Client;
    private bucket: string;

    constructor() {
        this.client = new S3Client({
            region: config.s3.region,
            credentials: {
                accessKeyId: config.s3.accessKeyId,
                secretAccessKey: config.s3.secretAccessKey,
            },
            ...(config.s3.endpoint && { endpoint: config.s3.endpoint }),
        });
        this.bucket = config.s3.bucketName;
    }

    /**
     * Generate a presigned URL for upload
     */
    async getUploadUrl({
        key,
        expiresIn = 3600,
        contentType,
    }: S3PresignedUrlParams): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn });
        return url;
    }

    /**
     * Generate a presigned URL for download
     */
    async getDownloadUrl({
        key,
        expiresIn = 3600,
    }: S3PresignedUrlParams): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const url = await getSignedUrl(this.client, command, { expiresIn });
        return url;
    }

    /**
     * Upload a file to S3
     */
    async uploadFile(
        key: string,
        body: Buffer | Uint8Array | string,
        contentType?: string
    ): Promise<UploadResult> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        const response = await this.client.send(command);

        return {
            bucket: this.bucket,
            key,
            versionId: response.VersionId,
            url: `https://${this.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`,
        };
    }

    /**
     * Get file from S3 as buffer
     */
    async getFile(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        const response = await this.client.send(command);

        if (!response.Body) {
            throw new Error("File not found or empty");
        }

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });

        await this.client.send(command);
    }

    /**
     * Generate S3 key for document
     */
    generateDocumentKey(
        submissionId: string,
        documentId: string,
        fileName: string
    ): string {
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        return `submissions/${submissionId}/documents/${documentId}_${timestamp}_${sanitizedFileName}`;
    }

    /**
     * Generate S3 key for report PDF
     */
    generateReportKey(reportId: string): string {
        return `reports/${reportId}/underwriting_report.pdf`;
    }
}

export const s3Service = new S3Service();
