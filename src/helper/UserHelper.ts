import { Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import * as redis from "redis";

type UserBody = {
    username?: string;
    password?: string;
    repassword?: string;
    nickname?: string;
    email?: string;
    oldpassword?: string;
    newpassword?: string;
    renewpassword?: string;
};

export async function usernameValidator(req: Request, res: Response, next: NextFunction){
    await body("username").exists().isLength({ min: 3 }).withMessage("Length of username is at least 3").bail()
        .isLength({ max: 20 }).withMessage("Length of username is at most 20").bail()
        .matches("^[A-Za-z0-9_]*$").withMessage("Username can only contain alpha, number and underscores (_)")
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
        const pwdlen = (req.body as UserBody).password.length;
        if(value === "")
            throw new Error("Repeat password is required");
        if(pwdlen >= 6 && pwdlen <= 50 && value !== (req.body as UserBody).password)
            throw new Error("Password and repeat password are not matched");
        return true;
    })
        .run(req);
    next();
}

export async function nicknameValidator(req: Request, res: Response, next: NextFunction){
    await body("nickname").exists().notEmpty().withMessage("Name is required").bail()
        .isLength({ max: 200 }).withMessage("Length of nickname is at most 200, please use abbreviation").trim().escape()
        .run(req);
    next();
}

export async function realnameValidator(req: Request, res: Response, next: NextFunction){
    await body("realname").exists().notEmpty().withMessage("Realname is required").bail()
        .isLength({ max: 200 }).withMessage("Length of realname is at most 200, plwase use abbreviation").trim().escape()
        .run(req);
    next();
}

export async function emailValidator(req: Request, res: Response, next: NextFunction){
    await body("email").exists().trim().notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Invalid email address format").normalizeEmail()
        .run(req);
    next();
}

export async function oldpasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("oldpassword").exists().notEmpty().withMessage("Old Password is required").bail()
        .run(req);
    next();
}

export async function newpasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("newpassword").exists().if(body("newpassword").notEmpty())
        .isLength({ min: 6 }).withMessage("Length of new password is at least 6")
        .isLength({ max: 50 }).withMessage("Length of new password is at most 50")
        .run(req);
    next();
}

export async function renewpasswordValidator(req: Request, res: Response, next: NextFunction){
    await body("renewpassword").exists().custom((value, { req }) => {
        const pwdlen = (req.body as UserBody).newpassword.length;
        if(pwdlen >= 6 && pwdlen <= 50){
            if(value === "")
                throw new Error("Repeat new password is required");
            if(value !== (req.body as UserBody).newpassword)
                throw new Error("New password and repeat new password are not matched");
        }
        return true;
    })
        .run(req);
    next();
}

export async function expireSessions(userID: number, currentSessionID){
    const redisClient = await redis.createClient({ url: `redis://${process.env.REDIS_HOST || "localhost:6379"}`, legacyMode: true });
    await redisClient.connect().catch(console.error);
    return new Promise((resolve, reject) => {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        redisClient.scan(0, (err, reply) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const sessions = reply[1] as string[];
            if(err)
                reject(err);
            Promise.all(sessions.map(async session => {
                return new Promise((resolve, reject) => {
                    // @ts-ignore
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    redisClient.get(session, (err, val) => {
                        if(err)
                            reject(err);
                        else
                            resolve([session, val]);
                    });
                });
            })).then(async result => {
                const toBeDel = result.filter(session => {
                    const sessionID = session[0];
                    const sessionData = JSON.parse(session[1]);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    return sessionData.passport && sessionData.passport.user && sessionData.passport.user === userID && sessionID.split(":")[1] !== currentSessionID;
                });
                Promise.all(toBeDel.map(async session => {
                    return new Promise((resolve, reject) => {
                        // @ts-ignore
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises, @typescript-eslint/no-unused-vars
                        redisClient.del(session[0], (err, result) => {
                            if(err)
                                reject(err);
                            else
                                resolve(null);
                        });
                    });
                })).then(result => {  // eslint-disable-line @typescript-eslint/no-unused-vars
                    resolve(null);
                }).catch(err => reject(err));
            }).catch(err => reject(err));
        });
    });
}
