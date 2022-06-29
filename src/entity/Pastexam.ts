/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Base } from "./Base";
import { User } from "./User";
import { Attachment } from "./Attachment";
import { Entity, Column, ManyToOne, JoinColumn, RelationId, OneToMany } from "typeorm";

@Entity()
export class Pastexam extends Base{

    @Column()
    title: string;

    @Column("text")
    content: string;

    @ManyToOne(type => User, user => user.pastexams, {
        cascade: true,
        onDelete: "NO ACTION"
    })
    @JoinColumn()
    author: User;

    @RelationId((pastexam: Pastexam) => pastexam.author)
    @Column()
    authorId: number;

    @OneToMany(type => Attachment, attachment => attachment.pastexam)
    attachments: Attachment[];

    @Column({ default: false })
    isPinned: boolean;

    @Column({ default: false })
    isPublic: boolean;

}
