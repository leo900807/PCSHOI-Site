import { Request, Response, NextFunction } from "express";
import { Pastexam } from "../entity/Pastexam";
import { adjustTimeString } from "./AppHelper";
import * as multer from "multer";
import * as path from "path";
import * as fs from "fs";

export type NormPastexam = Pastexam & { createdAt: string };

const attachmentDirectory = path.join(__dirname, "../", process.env.ATTACHMENT_DIR);

const storage = multer.diskStorage({
    destination: function(req, file, cb){
        fs.existsSync(attachmentDirectory) || fs.mkdirSync(attachmentDirectory);
        cb(null, attachmentDirectory);
    },
    filename: function(req, file, cb){
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
        const extension = path.extname(file.originalname);
        const filename = path.basename(file.originalname, extension);
        cb(null, `${filename}-${Date.now()}${extension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fieldNameSize: 200,
        fieldSize: 4194304,
        fileSize: Number(process.env.MAX_FILE_SIZE)
    }
});

export function normalizePastexam(pastexams: Pastexam[]){
    return pastexams.map(pastexam => {
        (pastexam.createdAt as unknown as string) = adjustTimeString(pastexam.createdAt).split(" ")[0];
        return pastexam as NormPastexam;
    });
}

export function uploadFile(req: Request, res: Response, next: NextFunction){
    upload.array("attachments")(req, res, err => {
        if(err instanceof multer.MulterError){
            if(err.code === "LIMIT_FILE_SIZE"){
                req.flash("bottomRightError", "File is too large to upload");
                if(req.method === "POST")
                    return res.redirect("back");
                else
                    return res.sendStatus(422);
            }
        }
        next();
    });
}
