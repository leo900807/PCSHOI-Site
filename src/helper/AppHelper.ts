import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

export function isLoggedIn(nextTo?: string){
    return (req: Request, res: Response, next: NextFunction) => {
        if(req.isAuthenticated())
            return next();
        req.flash("bottomRightError", "Please login before operation");
        if(nextTo)
            res.redirect(303, `/login?next=${nextTo}`);
        else
            res.redirect(303, "/login");
    };
}

export function isLoggedInWithMessage(message?: string){
    return (req: Request, res: Response, next: NextFunction) => {
        if(req.isAuthenticated())
            return next();
        req.flash("bottomRightError", message);
        res.redirect("/login");
    };
}

export function isAdmin(req: Request, res: Response, next: NextFunction){
    if(req.isAuthenticated() && req.user.admin)
        return next();
    next("Not Found");
}

export function getAdjustedTime(date: Date): Date{
    return new Date(date.getTime() + 1000 * 60 * 60 * 8);  // UTC+8
}

export function adjustTimeString(date: Date): string{
    date = new Date(date.getTime() + 1000 * 60 * 60 * 8);  // UTC+8
    return date.toISOString().split(".")[0].replace("T", " ");
}

export function checkIdValid(req: Request, res: Response, next: NextFunction){
    if(!req.params.id || isNaN(Number(req.params.id)) || Number(req.params.id) <= 0)
        next("Not Found");
    else
        next();
}

export function isNumber(num: string){
    return !isNaN(Number(num));
}

export function isInteger(num: string){
    return isNumber(num) && Number.isInteger(Number(num));
}

export function isPositiveInteger(num: string){
    return isInteger(num) && Number(num) > 0;
}

export function errorSet(req: Request, errorFlash: string, errorData: string, bodyString: string){
    const error = validationResult(req);
    if(error.isEmpty())
        return false;
    const errorArr = [];
    error.array().forEach(err => errorArr.push(err.msg));
    req.flash(errorFlash, errorArr.toString());
    req.flash(errorData, bodyString);
    return true;
}

export function errorGet(req: Request, errorFlash: string, errorData: string){
    const error = req.flash(errorFlash);
    const flashData = req.flash(errorData);
    const data = { error: [], data: {} };
    if(error.length > 0)
        data.error = error[0].split(",");
    if(flashData.length > 0)
        data.data = JSON.parse(flashData[0]);
    return data;
}
