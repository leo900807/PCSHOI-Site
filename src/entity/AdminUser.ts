import { Base } from "./Base";
import { Entity, Column } from "typeorm";

@Entity()
export class AdminUser extends Base{

    @Column({ unique: true })
    email: string;

    @Column()
    encryptedPassword: string;

}
