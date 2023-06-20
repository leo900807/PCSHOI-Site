import { createDatabase } from "typeorm-extension";
import { AppDataSource } from "./data-source";

(async () => {
    createDatabase({ ifNotExist: true, synchronize: false }).then(async() => {
        AppDataSource.initialize().then(async connection => {
            await connection.synchronize();
            await connection.runMigrations({ transaction: 'all' });
            console.log("Database successfully created.");
            connection.close();
        });
    }).catch(err => console.log(err));
})();
