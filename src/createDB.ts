import { createDatabase } from "typeorm-extension";
import { AppDataSource } from "./data-source";

(async () => {
    createDatabase({ ifNotExist: true, synchronize: false }).then(async() => {
        await AppDataSource.initialize().then(async connection => {
            await connection.synchronize();
            await connection.runMigrations({ fake: true });
            console.log("Database was successfully created.");
            await connection.close();
        });
    }).catch(err => console.log(err));
})().catch(err => console.log(err));
