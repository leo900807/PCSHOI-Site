import { createDatabase } from "typeorm-extension";
import { AppDataSource } from "./data-source";

(async () => {
    createDatabase({ ifNotExist: true, synchronize: false }).then(async() => {
        AppDataSource.initialize().then(async connection => {
            await connection.synchronize();
            await connection.runMigrations({ fake: true });
            console.log("Database was successfully created.");
            connection.close();
        });
    }).catch(err => console.log(err));
})();
