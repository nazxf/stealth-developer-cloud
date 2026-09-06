import { z } from "zod";
import { download, request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

const storageBucketSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  file_security: z.boolean(),
  create_permissions: z.array(z.string()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  max_file_size_bytes: z.number(),
  quota_bytes: z.number(),
  used_bytes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
const storageFileSchema = z.object({
  id: z.string(),
  bucket_id: z.string(),
  project_id: z.string(),
  name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  checksum_sha256: z.string(),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  creator_project_user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type BrowserStorageBucket = z.infer<typeof storageBucketSchema>;
export type BrowserStorageFile = z.infer<typeof storageFileSchema>;

export const storageAPI = {
  projectStorageBuckets: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets`, query), z.object({ buckets: z.array(storageBucketSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectStorageBucket: (projectID: string, input: { name: string; file_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[]; max_file_size_bytes?: number; quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets`, z.object({ bucket: storageBucketSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectStorageBucket: (projectID: string, bucketID: string, input: Partial<{ name: string; file_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; max_file_size_bytes: number; quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, z.object({ bucket: storageBucketSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectStorageBucket: (projectID: string, bucketID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, z.undefined(), { method: "DELETE" }),
  projectStorageFiles: (projectID: string, bucketID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files`, query), z.object({ files: z.array(storageFileSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectStorageFile: (projectID: string, bucketID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files`, z.object({ file: storageFileSchema }), { method: "POST", body: form }),
  deleteProjectStorageFile: (projectID: string, bucketID: string, fileID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, z.undefined(), { method: "DELETE" }),
  downloadProjectStorageFile: (projectID: string, bucketID: string, fileID: string) =>
    download(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}/download`),
};
