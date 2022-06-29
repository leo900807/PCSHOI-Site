/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Base } from "./Base";
import { Article } from "./Article";
import { Pastexam } from "./Pastexam";
import { Registration } from "./Registration";
import { Entity, Column, OneToMany } from "typeorm";

@Entity()
export class User extends Base{

    @Column({ unique: true })
    username: string;

    @Column()
    encryptedPassword: string;

    @Column()
    nickname: string;

    @Column()
    realname: string;

    @Column({ unique: true, length: 330 })
    email: string;

    @Column({ default: false })
    admin: boolean;

    @Column({ nullable: true })
    resetPasswordToken: string;

    @Column({ nullable: true })
    resetPasswordTokenSentAt: Date;

    @Column({ nullable: true })
    rememberCreatedAt: Date;

    @Column({ nullable: true })
    lastLoginAt: Date;

    @OneToMany(type => Article, article => article.author)
    articles: Article[];

    @OneToMany(type => Pastexam, pastexam => pastexam.author)
    pastexams: Pastexam[];

    @OneToMany(type => Registration, registration => registration.registrant)
    registrations: [];

}
