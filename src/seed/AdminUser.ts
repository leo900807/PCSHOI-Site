import { DataSource } from "typeorm";
import { Seeder, SeederFactoryManager } from "typeorm-extension";
import { AdminUser } from "../entity/AdminUser";
import { encrypt } from "../helper/PasswordHelper";

export default class AdminUserSeeder implements Seeder {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<void>{
        const adminUserRepository = dataSource.getRepository(AdminUser);
        const adminUser = new AdminUser();
        adminUser.email = "mail@pcshic.club";
        adminUser.encryptedPassword = await encrypt("adminuser");
        await adminUserRepository.save(adminUser);
    }
}
