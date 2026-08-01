import { app } from "electron";
import fs from "fs";
import path from "path";


export class BlobStorage {

    private static instance: BlobStorage | null = null;


    private blobRootPath: string;


    private constructor() {

        const userDataPath = app.getPath("userData");

        this.blobRootPath = path.join(
            userDataPath,
            "blobs"
        );
    }


    public static getInstance(): BlobStorage {

        if (BlobStorage.instance === null) {

            BlobStorage.instance =
                new BlobStorage();
        }


        return BlobStorage.instance;
    }


    public async save(
        relativePath: string,
        data: Blob
    ): Promise<void> {

        const absolutePath =
            this.resolveAbsolutePath(relativePath);


        const directory =
            path.dirname(absolutePath);


        if (!fs.existsSync(directory)) {

            fs.mkdirSync(
                directory,
                {
                    recursive: true
                }
            );
        }


        const buffer =
            Buffer.from(
                await data.arrayBuffer()
            );


        fs.writeFileSync(
            absolutePath,
            buffer
        );
    }


    public load(
        relativePath: string
    ): Blob {

        const absolutePath =
            this.resolveAbsolutePath(relativePath);


        const buffer = fs.readFileSync(absolutePath);

        return new Blob([
            new Uint8Array(buffer)
        ]);
    }


    public delete(
        relativePath: string
    ): void {

        const absolutePath =
            this.resolveAbsolutePath(relativePath);


        if (fs.existsSync(absolutePath)) {

            fs.unlinkSync(absolutePath);
        }
    }


    public exists(
        relativePath: string
    ): boolean {

        const absolutePath =
            this.resolveAbsolutePath(relativePath);


        return fs.existsSync(
            absolutePath
        );
    }


    public resolveAbsolutePath(
        relativePath: string
    ): string {

        return path.join(
            this.blobRootPath,
            relativePath
        );
    }
}