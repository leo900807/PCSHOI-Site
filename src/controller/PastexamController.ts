import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Patch, Delete, Req, Res, Next, Body, Query, Params } from "@reflet/express";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { Pastexam } from "../entity/Pastexam";
import { Attachment } from "../entity/Attachment";
import { isAdmin, adjustTimeString, checkIdValid, isPositiveInteger, errorGet, errorSet } from "../helper/AppHelper";
import { NormPastexam, normalizePastexam, uploadFile } from "../helper/PastexamHelper";
import { body } from "express-validator";
import * as path from "path";
import * as fs from "fs";

type PastexamBody = {
    _csrf?: string;
    title: string;
    content: string;
    isPinned?: string;
    isPublic?: string;
};

const attachmentDirectory = path.join(__dirname, "../", process.env.ATTACHMENT_DIR);

@Router("/pastexams")
export class PastexamController extends AppController{

    private readonly pastexamRepository = AppDataSource.getRepository(Pastexam);
    private readonly attachmentRepository = AppDataSource.getRepository(Attachment);

    @Get()
    async index(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Query("page") page?: string){
        const pageLimit = 30;
        let rawPastexams: Pastexam[];
        let rawPinnedPastexams: Pastexam[];
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
            count = await this.pastexamRepository.count({ where: { isPinned: false } });
        else
            count = await this.pastexamRepository.count({ where: { isPublic: true, isPinned: false } });
        const pageCount = Math.ceil(count / pageLimit);
        if(nowOnPage > pageCount && nowOnPage !== 1)
            return next("Not Found");

        // get articles
        if(req.isAuthenticated() && req.user.admin){
            rawPinnedPastexams = await this.pastexamRepository.find({ where: { isPinned: true }, order: { createdAt: "DESC" } });
            rawPastexams = await this.pastexamRepository.find({ where: { isPinned: false }, order: { createdAt: "DESC" }, skip: (nowOnPage - 1) * pageLimit, take: pageLimit });
        }
        else{
            rawPinnedPastexams = await this.pastexamRepository.find({ where: { isPublic: true, isPinned: true }, order: { createdAt: "DESC" } });
            rawPastexams = await this.pastexamRepository.find({ where: { isPublic: true, isPinned: false }, order: { createdAt: "DESC" }, skip: (nowOnPage - 1) * pageLimit, take: pageLimit });
        }
        const pinnedPastexams: NormPastexam[] = normalizePastexam(rawPinnedPastexams);
        const pastexams: NormPastexam[] = normalizePastexam(rawPastexams);

        // render
        res.locals.nowOnPage = nowOnPage;
        res.locals.pageCount = pageCount;
        res.locals.pageTitle = "Pastexams";
        res.render("pastexam/index.ejs", { pinnedPastexams: pinnedPastexams, pastexams: pastexams });
    }

    @Get("/new")
    @Use(isAdmin)
    async new(@Req req: Request, @Res res: Response){
        const { error, data } = errorGet(req, "new pastexam error", "new pastexam data");
        res.locals.newPastexamError = error;
        res.locals.pageTitle = "New pastexam";
        res.render("pastexam/new.ejs", data);
    }

    @Post()
    @Use(isAdmin)
    @Use(uploadFile)
    @Use(body("title").exists().trim().notEmpty().withMessage("Title is required").bail()
        .isLength({ max: 255 }).withMessage("Title length is at most 255"))
    @Use(body("content").exists().isLength({ max: 65535 }).withMessage("Content length is at most 65535"))
    async create(@Req req: Request, @Res res: Response, @Body body: PastexamBody){
        let attachmentKeys: string[] = [];
        if(req.files)
            attachmentKeys = Object.keys(req.files);
        if(errorSet(req, "new pastexam error", "new pastexam data", JSON.stringify(body))){
            for(const attachmentKey of attachmentKeys){
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                fs.unlink(path.join(attachmentDirectory, req.files[attachmentKey].filename), err => {
                    if(err)
                        console.error(err);
                });
            }
            return res.redirect(303, "/pastexams/new");
        }
        const pastexam: Pastexam = new Pastexam();
        pastexam.title = body.title;
        pastexam.content = body.content;
        pastexam.isPinned = body.isPinned && body.isPinned === "true" ? true : false;
        pastexam.isPublic = body.isPublic && body.isPublic === "true" ? true : false;
        pastexam.author = req.user;
        await this.pastexamRepository.save(pastexam);
        for(const attachmentKey of attachmentKeys){
            const attachment: Attachment = new Attachment();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            attachment.filename = req.files[attachmentKey].originalname;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            attachment.realFilename = req.files[attachmentKey].filename;
            attachment.pastexam = pastexam;
            await this.attachmentRepository.save(attachment);
        }
        req.flash("bottomRightSuccess", "Successfully created");
        return res.redirect(`/pastexams/${pastexam.id}`);
    }

    @Get("/:id/edit")
    @Use(isAdmin)
    @Use(checkIdValid)
    async edit(@Req req: Request, @Res res: Response, @Params("id") id: string){
        const pastexam: Pastexam = await this.pastexamRepository.findOne({ where: { id: Number(id) }, relations: { attachments: true } });
        const { error, data } = errorGet(req, "edit pastexam error", "edit pastexam data");
        res.locals.editPastexamError = error;
        res.locals.pageTitle = `Edit - ${pastexam.title}`;
        if(error.length > 0){
            res.locals.id = Number(id);
            res.render("pastexam/edit.ejs", data);
        }
        else
            res.render("pastexam/edit.ejs", pastexam);
    }

    @Patch("/:id")
    @Use(isAdmin)
    @Use(checkIdValid)
    @Use(uploadFile)
    @Use(body("title").exists().trim().notEmpty().withMessage("Title is required").bail()
        .isLength({ max: 255 }).withMessage("Title length is at most 255"))
    @Use(body("content").exists().isLength({ max: 65535 }).withMessage("Content length is at most 65535"))
    async update(@Req req: Request, @Res res: Response, @Params("id") id: string, @Body body: PastexamBody){
        let attachmentKeys: string[] = [];
        if(req.files)
            attachmentKeys = Object.keys(req.files);
        if(errorSet(req, "edit pastexam error", "edit pastexam data", JSON.stringify(body))){
            for(const attachmentKey of attachmentKeys){
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                fs.unlink(path.join(attachmentDirectory, req.files[attachmentKey].filename), err => {
                    if(err)
                        console.error(err);
                });
            }
            return res.sendStatus(422);
        }
        const pastexam: Pastexam = await this.pastexamRepository.findOneById(Number(id));
        pastexam.title = body.title;
        pastexam.content = body.content;
        pastexam.isPinned = body.isPinned && body.isPinned === "true" ? true : false;
        pastexam.isPublic = body.isPublic && body.isPublic === "true" ? true : false;
        pastexam.author = req.user;
        await this.pastexamRepository.save(pastexam);
        for(const attachmentKey of attachmentKeys){
            const attachment: Attachment = new Attachment();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            attachment.filename = req.files[attachmentKey].originalname;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            attachment.realFilename = req.files[attachmentKey].filename;
            attachment.pastexam = pastexam;
            await this.attachmentRepository.save(attachment);
        }
        req.flash("bottomRightSuccess", "Successfully updated");
        res.json({ status: 200, redirectUri: `/pastexams/${id}` });
    }

    @Delete("/:id")
    @Use(isAdmin)
    @Use(checkIdValid)
    async destroy(@Req req: Request, @Res res: Response, @Params("id") id: string){
        const pastexam: Pastexam = await this.pastexamRepository.findOne({ where: { id: Number(id) }, relations: ["attachments"] });
        if(pastexam){
            pastexam.attachments.forEach(async file => {
                fs.unlink(path.join(attachmentDirectory, file.realFilename), err => {
                    if(err)
                        console.error(err);
                });
            });
            await this.pastexamRepository.remove(pastexam);
            req.flash("bottomRightSuccess", "Successfully deleted");
            res.json({ status: 200, redirectUri: "/pastexams" });
        }
        else{
            req.flash("bottomRightError", "Nothing to be deleted");
            res.status(422).json({ status: 422, reason: "Nothing to be deleted" });
        }
    }

    @Get("/:id")
    @Use(checkIdValid)
    async show(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Params("id") id: string){
        const pastexam: Pastexam = await this.pastexamRepository.findOne({ where: { id: Number(id) }, relations: { author: true, attachments: true } });
        if(!pastexam || !(req.isAuthenticated() && req.user.admin) && !pastexam.isPublic)
            return next("Not Found");
        (pastexam.createdAt as unknown as string) = adjustTimeString(pastexam.createdAt);
        (pastexam.updatedAt as unknown as string) = adjustTimeString(pastexam.updatedAt);
        pastexam.content = this.converter.makeHtml(pastexam.content);
        res.locals.pageTitle = pastexam.title;
        res.render("pastexam/show.ejs", pastexam);
    }

}
