import { Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import * as path from "path";
import * as fs from "fs";

export const REGISTRATION_METADATA_FULLPATH = path.join(__dirname, "../", process.env.REGISTRATION_METADATA_FILE);

export type RegistrationMetadata = {
    yearOfContest: number;
    registerStart: Date;
    registerEnd: Date;
};

type RegistrationBody = {
    yearofcontest?: string;
    studentid?: string;
    classseat?: string;
    password?: string;
    repassword?: string;
};

type RegistrationEditBody = {
    newpassword?: string;
    renewpassword?: string;
};

export const REGISTRATION_METADATA_DEFAULT: RegistrationMetadata = {
    yearOfContest: -1,
    registerStart: new Date(2000, 11, 31, 8, 0, 0),
    registerEnd: new Date(2000, 11, 31, 8, 0, 0)
};

export async function studentIdValidator(req: Request, res: Response, next: NextFunction){
    await body("studentid").exists().trim().notEmpty().withMessage("Student ID is required").bail()
        .isLength({ min: 6, max: 6 }).withMessage("Format of Student ID is wrong").bail()
        .isInt().withMessage("Format of Student ID is wrong")
        .run(req);
    next();
}

export async function classSeatValidator(req: Request, res: Response, next: NextFunction){
    await body("classseat").exists().trim().notEmpty().withMessage("Class & Seat is required").bail()
        .isLength({ min: 5, max: 5 }).withMessage("Format of Class & Seat is wrong").bail()
        .isInt().withMessage("Format of Class & Seat is wrong")
        .run(req);
    next();
}

export async function passwordValidator(req: Request, res: Response, next: NextFunction){
    await body("password").exists().notEmpty().withMessage("Password is required").bail()
        .isLength({ min: 6 }).withMessage("Length of password is at least 6")
        .isLength({ max: 50 }).withMessage("Length of password is at most 50")
        .run(req);
    next();
}

export async function repasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("repassword").exists().custom((value, { req }) => {
        const pwdlen = (req.body as RegistrationBody).password.length;
        if(value === "")
            throw new Error("Repeat password is required");
        if(pwdlen >= 6 && pwdlen <= 50 && value !== (req.body as RegistrationBody).password)
            throw new Error("Password and repeat password are not matched");
        return true;
    })
        .run(req);
    next();
}

export async function newpasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("newpassword").exists().notEmpty().withMessage("New password is required").bail()
        .isLength({ min: 6 }).withMessage("Length of new password is at least 6")
        .isLength({ max: 50 }).withMessage("Length of new password is at most 50")
        .run(req);
    next();
}

export async function renewpasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("renewpassword").exists().custom((value, { req }) => {
        const pwdlen = (req.body as RegistrationEditBody).newpassword.length;
        if(value === "")
            throw new Error("Repeat new password is required");
        if(pwdlen >= 6 && pwdlen <= 50 && value !== (req.body as RegistrationEditBody).newpassword)
            throw new Error("New password and repeat new password are not matched");
        return true;
    })
        .run(req);
    next();
}

export async function yearOfContestValidator(req: Request, res: Response, next: NextFunction){
    await body("yearofcontest").exists().trim().notEmpty().withMessage("Year of contest is required").bail()
        .isInt({ "allow_leading_zeroes": false }).withMessage("Year of contest must be an integer")
        .run(req);
    next();
}

export async function registerStartValidator(req: Request, res: Response, next: NextFunction){
    await body("registerstart").exists().trim().notEmpty().withMessage("Register start is required").bail()
        .isISO8601().withMessage("Format of register start is wrong")
        .run(req);
    next();
}

export async function registerEndValidator(req: Request, res: Response, next: NextFunction){
    await body("registerend").exists().trim().notEmpty().withMessage("Register end is required").bail()
        .isISO8601().withMessage("Format of register end is wrong")
        .run(req);
    next();
}

export function setRegistrationMetadata(metadata: RegistrationMetadata){
    return new Promise((resolve, reject) => {
        fs.writeFile(REGISTRATION_METADATA_FULLPATH, JSON.stringify(metadata), err => {
            if(err)
                reject(err);
            else
                resolve(null);
        });
    });
}

export function getRegistrationMetadata(): Promise<RegistrationMetadata>{
    return new Promise((resolve, reject) => {  // eslint-disable-line @typescript-eslint/no-unused-vars
        if(!fs.existsSync(REGISTRATION_METADATA_FULLPATH))
            fs.writeFileSync(REGISTRATION_METADATA_FULLPATH, JSON.stringify(REGISTRATION_METADATA_DEFAULT));
        fs.readFile(REGISTRATION_METADATA_FULLPATH, (err, data) => {
            if(err){
                console.error(err);
                resolve(REGISTRATION_METADATA_DEFAULT);
            }
            else{
                const result: RegistrationMetadata = JSON.parse(data.toString());
                result.registerStart = new Date((result.registerStart as unknown) as string);
                result.registerEnd = new Date((result.registerEnd as unknown) as string);
                resolve(result);
            }
        });
    });
}
