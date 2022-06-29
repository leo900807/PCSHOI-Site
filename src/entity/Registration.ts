/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Base } from "./Base";
import { User } from "./User";
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from "typeorm";

@Entity()
export class Registration extends Base{

    @ManyToOne(type => User, user => user.registrations, {
        cascade: true,
        onDelete: "NO ACTION"
    })
    @JoinColumn()
    registrant: User;

    @RelationId((registration: Registration) => registration.registrant)
    @Column()
    registrantId: number;

    @Column()
    studentId: string;

    @Column()
    classSeat: string;

    @Column()
    encryptedPassword: string;

    @Column()
    verificationCode: string;

    @Column()
    registerYear: number;

    @Column("decimal", { precision: 5, scale: 2, nullable: true })
    score: number;

    @Column({ nullable: true })
    rank: number;

}
