import { Article } from "../entity/Article";
import { adjustTimeString } from "./AppHelper";

export type NormArticle = Article & { createdAt: string };

export function normalizeArticle(articles: Article[]){
    return articles.map(article => {
        (article.createdAt as unknown as string) = adjustTimeString(article.createdAt).split(" ")[0];
        return article as NormArticle;
    });
}
