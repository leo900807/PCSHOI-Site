/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Base } from "./Base";
import { Pastexam } from "./Pastexam";
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from "typeorm";

@Entity({ orderBy: { id: "ASC" } })
export class Attachment extends Base{

    @ManyToOne(type => Pastexam, pastexam => pastexam.attachments, {
        cascade: true,
        onDelete: "CASCADE"
    })
    @JoinColumn()
    pastexam: Pastexam;

    @RelationId((attachment: Attachment) => attachment.pastexam)
    @Column()
    pastexamId: number;

    @Column()
    filename: string;

    @Column()
    realFilename: string;

    @Column({ default: 0 })
    position: number;

}
