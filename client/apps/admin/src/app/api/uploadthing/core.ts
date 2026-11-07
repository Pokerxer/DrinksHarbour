import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { authorizeUpload } from './upload-authorization';

const f = createUploadthing();

export const ourFileRouter = {
  avatar: f({ image: { maxFileSize: '4MB' } })
    .middleware(authorizeUpload)
    .onUploadComplete(({ metadata }) => ({ uploadedBy: metadata.userId })),

  generalMedia: f({
    'application/pdf': { maxFileSize: '4MB', maxFileCount: 4 },
    image: { maxFileSize: '2MB', maxFileCount: 4 },
    video: { maxFileSize: '256MB', maxFileCount: 1 },
  })
    .middleware(authorizeUpload)
    .onUploadComplete(({ metadata }) => ({ uploadedBy: metadata.userId })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
