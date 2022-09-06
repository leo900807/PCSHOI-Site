import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Patch, Delete, Req, Res, Next, Body, Query, Params } from "@reflet/express";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { Article } from "../entity/Article";
import { isAdmin, adjustTimeString, checkIdValid, isPositiveInteger, errorGet, errorSet } from "../helper/AppHelper";
import { NormArticle, normalizeArticle } from "../helper/ArticleHelper";
import { body } from "express-validator";

type ArticleBody = {
    _csrf?: string;
    title: string;
    content: string;
    isPinned?: string;
    isPublic?: string;
};

@Router("/articles")
export class ArticleController extends AppController{

    private readonly articleRepository = AppDataSource.getRepository(Article);

    @Get()
    async index(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Query("page") page?: string){
        const pageLimit = 30;
        let rawArticles: Article[];
        let rawPinnedArticles: Article[];
        let count: number;
        let nowOnPage: number;
        if(!page)
            nowOnPage = 1;
        else if(isPositiveInteger(page))
            nowOnPage = Number(page);
        else
            return next("Not Found");

        // get page count
        if(req.isAuthenticated() && req.user.admin)
            count = await this.articleRepository.count({ where: { isPinned: false } });
        else
            count = await this.articleRepository.count({ where: { isPublic: true, isPinned: false } });
        const pageCount = Math.ceil(count / pageLimit);
        if(nowOnPage > pageCount && nowOnPage !== 1)
            return next("Not Found");

        // get articles
        if(req.isAuthenticated() && req.user.admin){
            rawPinnedArticles = await this.articleRepository.find({ where: { isPinned: true }, order: { createdAt: "DESC" } });
            rawArticles = await this.articleRepository.find({ where: { isPinned: false }, order: { createdAt: "DESC" }, skip: (nowOnPage - 1) * pageLimit, take: pageLimit });
        }
        else{
            rawPinnedArticles = await this.articleRepository.find({ where: { isPublic: true, isPinned: true }, order: { createdAt: "DESC" } });
            rawArticles = await this.articleRepository.find({ where: { isPublic: true, isPinned: false }, order: { createdAt: "DESC" }, skip: (nowOnPage - 1) * pageLimit, take: pageLimit });
        }
        const pinnedArticles: NormArticle[] = normalizeArticle(rawPinnedArticles);
        const articles: NormArticle[] = normalizeArticle(rawArticles);

        // render
        res.locals.nowOnPage = nowOnPage;
        res.locals.pageCount = pageCount;
        res.locals.pageTitle = "Articles";
        res.render("article/index.ejs", { pinnedArticles, articles });
    }

    @Get("/new")
    @Use(isAdmin)
    async new(@Req req: Request, @Res res: Response){
        const { error, data } = errorGet(req, "new article error", "new article data");
        res.locals.newArticleError = error;
        res.locals.pageTitle = "New article";
        res.render("article/new.ejs", data);
    }

    @Post()
    @Use(isAdmin)
    @Use(body("title").exists().trim().notEmpty().withMessage("Title is required").bail()
        .isLength({ max: 255 }).withMessage("Title length is at most 255"))
    @Use(body("content").exists().isLength({ max: 65535 }).withMessage("Content length is at most 65535"))
    async create(@Req req: Request, @Res res: Response, @Body body: ArticleBody){
        if(errorSet(req, "new article error", "new article data", JSON.stringify(body)))
            return res.redirect(303, "/articles/new");
        const article: Article = new Article();
        article.title = body.title;
        article.content = body.content;
        article.isPinned = body.isPinned && body.isPinned === "true" ? true : false;
        article.isPublic = body.isPublic && body.isPublic === "true" ? true : false;
        article.author = req.user;
        await this.articleRepository.save(article);
        req.flash("bottomRightSuccess", "Successfully created");
        res.redirect(`/articles/${article.id}`);
    }

    @Get("/:id/edit")
    @Use(isAdmin)
    @Use(checkIdValid)
    async edit(@Req req: Request, @Res res: Response, @Params("id") id: string){
        const article: Article = await this.articleRepository.findOneById(Number(id));
        const { error, data } = errorGet(req, "edit article error", "edit article data");
        res.locals.editArticleError = error;
        res.locals.pageTitle = `Edit - ${article.title}`;
        if(error.length > 0){
            res.locals.id = Number(id);
            res.render("article/edit.ejs", data);
        }
        else
            res.render("article/edit.ejs", article);
    }

    @Patch("/:id")
    @Use(isAdmin)
    @Use(checkIdValid)
    @Use(body("title").exists().trim().notEmpty().withMessage("Title is required").bail()
        .isLength({ max: 255 }).withMessage("Title length is at most 255"))
    @Use(body("content").exists().isLength({ max: 65535 }).withMessage("Content length is at most 65535"))
    async update(@Req req: Request, @Res res: Response, @Params("id") id: string, @Body body: ArticleBody){
        if(errorSet(req, "edit article error", "edit article data", JSON.stringify(body)))
            return res.sendStatus(422);
        const article: Article = await this.articleRepository.findOneById(Number(id));
        article.title = body.title;
        article.content = body.content;
        article.isPinned = body.isPinned && body.isPinned === "true" ? true : false;
        article.isPublic = body.isPublic && body.isPublic === "true" ? true : false;
        article.author = req.user;
        await this.articleRepository.save(article);
        req.flash("bottomRightSuccess", "Successfully updated");
        res.json({ status: 200, redirectUri: `/articles/${id}` });
    }

    @Delete("/:id")
    @Use(isAdmin)
    @Use(checkIdValid)
    async destroy(@Req req: Request, @Res res: Response, @Params("id") id: string){
        const article: Article = await this.articleRepository.findOneById(Number(id));
        if(article){
            await this.articleRepository.remove(article);
            req.flash("bottomRightSuccess", "Successfully deleted");
            res.json({ status: 200, redirectUri: "/articles" });
        }
        else{
            req.flash("bottomRightError", "Nosuch article");
            res.status(422).json({ status: 422, reason: "Nosuch article" });
        }
    }

    @Get("/:id")
    @Use(checkIdValid)
    async show(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Params("id") id: string){
        const article: Article = await this.articleRepository.findOne({ where: { id: Number(id) }, relations: { author: true } });
        if(!article || !(req.isAuthenticated() && req.user.admin) && !article.isPublic)
            return next("Not Found");
        (article.createdAt as unknown as string) = adjustTimeString(article.createdAt);
        (article.updatedAt as unknown as string) = adjustTimeString(article.updatedAt);
        article.content = this.converter.makeHtml(article.content);
        res.locals.pageTitle = article.title;
        res.render("article/show.ejs", article);
    }

}
