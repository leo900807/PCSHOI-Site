import { Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import { TokenGenerator } from "ts-token-generator";

export async function usernameValidator(req: Request, res: Response, next: NextFunction){
    await body("username").exists().notEmpty().withMessage("Username is required").trim()
        .run(req);
    next();
}

export async function emailValidator(req: Request, res: Response, next: NextFunction){
    await body("email").exists().trim().notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email address format").normalizeEmail()
        .run(req);
    next();
}

export function tokenGen(){
    const generator = new TokenGenerator({ bitSize: 512 });
    return generator.generate();
}
