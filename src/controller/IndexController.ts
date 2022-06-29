import { Request, Response } from "express";
import { Router, Get, Req, Res } from "@reflet/express";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { Article } from "../entity/Article";
import { Pastexam } from "../entity/Pastexam";
import { NormArticle, normalizeArticle } from "../helper/ArticleHelper";
import { NormPastexam, normalizePastexam } from "../helper/PastexamHelper";

@Router("/")
export class IndexController extends AppController{

    private readonly articleRepository = AppDataSource.getRepository(Article);
    private readonly pastexamRepository = AppDataSource.getRepository(Pastexam);

    @Get()
    async index(@Req req: Request, @Res res: Response){
        // Articles
        let rawArticles: Article[];
        let allArticles: NormArticle[];
        if(req.isAuthenticated() && req.user.admin)
            rawArticles = await this.articleRepository.find({ order: { createdAt: "DESC" } });
        else
            rawArticles = await this.articleRepository.find({ where: { isPublic: true }, order: { createdAt: "DESC" } });
        allArticles = normalizeArticle(rawArticles);  // eslint-disable-line prefer-const
        let pinnedArticles: NormArticle[] = allArticles.filter(article => article.isPinned === true);
        let articles: NormArticle[] = allArticles.filter(article => article.isPinned === false);
        if(pinnedArticles.length > 5)
            pinnedArticles = pinnedArticles.slice(0, 5);
        if(pinnedArticles.length + articles.length > 5)
            articles = articles.slice(0, 5 - pinnedArticles.length);

        // Pastexams
        let rawPastexams: Pastexam[];
        let allPastexams: NormPastexam[];
        if(req.isAuthenticated() && req.user.admin)
            rawPastexams = await this.pastexamRepository.find({ order: { createdAt: "DESC" } });
        else
            rawPastexams = await this.pastexamRepository.find({ where: { isPublic: true }, order: { createdAt: "DESC" } });
        allPastexams = normalizePastexam(rawPastexams);  // eslint-disable-line prefer-const
        let pinnedPastexams: NormPastexam[] = allPastexams.filter(pastexam => pastexam.isPinned === true);
        let pastexams: NormPastexam[] = allPastexams.filter(pastexam => pastexam.isPinned === false);
        if(pinnedPastexams.length > 5)
            pinnedPastexams = pinnedPastexams.slice(0, 5);
        if(pinnedPastexams.length + pastexams.length > 5)
            pastexams = pastexams.slice(0, 5 - pinnedPastexams.length);

        // render
        res.render("index/index.ejs", { pinnedArticles, articles, pinnedPastexams, pastexams });
    }

}
