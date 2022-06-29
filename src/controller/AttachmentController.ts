import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Delete, Req, Res, Next, Params } from "@reflet/express";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { Attachment } from "../entity/Attachment";
import { isAdmin } from "../helper/AppHelper";
import * as path from "path";
import * as fs from "fs";

const attachmentDirectory = path.join(__dirname, "../", process.env.ATTACHMENT_DIR);

@Router("/attachments")
export class AttachmentController extends AppController{

    private readonly attachmentRepository = AppDataSource.getRepository(Attachment);

    @Get("/:realFilename")
    async show(@Res res: Response, @Next next: NextFunction, @Params("realFilename") realFilename: string){
        const file: Attachment = await this.attachmentRepository.findOneBy({ realFilename: realFilename });
        if(file)
            res.download(path.join(attachmentDirectory, file.realFilename), file.filename);
        else
            next("Not Found");
    }

    @Delete("/:realFilename")
    @Use(isAdmin)
    async destroy(@Req req: Request, @Res res: Response, @Params("realFilename") realFilename: string){
        const file: Attachment = await this.attachmentRepository.findOneBy({ realFilename: realFilename });
        if(file){
            await this.attachmentRepository.remove(file);
            fs.unlink(path.join(attachmentDirectory, file.realFilename), err => {
                if(err)
                    console.error(err);
            });
            req.flash("bottomRightSuccess", "Attachment deleted");
            res.json({ status: 200, redirectUri: `/pastexams/${file.pastexamId}/edit` });
        }
        else{
            req.flash("bottomRightError", "No such attachment");
            res.status(422).json({ status: 422, reason: "No such attachment" });
        }
    }

}
