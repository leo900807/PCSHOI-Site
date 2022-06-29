/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Base } from "./Base";
import { User } from "./User";
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from "typeorm";

@Entity()
export class Article extends Base{

    @Column()
    title: string;

    @Column("text")
    content: string;

    @ManyToOne(type => User, user => user.articles, {
        cascade: true,
        onDelete: "NO ACTION"
    })
    @JoinColumn()
    author: User;

    @RelationId((article: Article) => article.author)
    @Column()
    authorId: number;

    @Column({ default: false })
    isPinned: boolean;

    @Column({ default: false })
    isPublic: boolean;

}
