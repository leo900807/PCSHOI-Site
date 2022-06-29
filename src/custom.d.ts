import { User as entityUser } from "./entity/User";

declare global{
    namespace Express{
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface User extends entityUser{
        }
        interface Request{
            sessionID?: string;
        }
    }
    namespace NodeJS{
        interface ProcessEnv{
            NODE_ENV: "production" | "development",
            PORT: number,
            SECRET: string,
            REDIS_HOST: string,
            MAX_FILE_SIZE: number,
            ATTACHMENT_DIR: string
        }
    }
}
