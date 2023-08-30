import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Delete, Req, Res, Body, Query } from "@reflet/express";
import { UseIf } from "@reflet/express-middlewares";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { User } from "../entity/User";
import * as passport from "passport";

type LoginBody = {
    _csrf?: string;
    username?: string;
    password?: string;
};

@Router("/login")
export class SessionController extends AppController{

    private readonly userRepository = AppDataSource.getRepository(User);

    @Get()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightSuccess", "You have already logged in");
        res.redirect("/");
    }])
    async new(@Res res: Response, @Query("next") nextTo?: string){
        res.locals.pageTitle = "Login";
        if(nextTo)
            res.locals.next = nextTo;
        res.render("session/new.ejs");
    }

    @Post()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightSuccess", "You have already logged in");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if(req.body.next)
            res.redirect(req.body.next);  // eslint-disable-line @typescript-eslint/no-unsafe-member-access
        else
            res.redirect("/");
    }])
    @UseIf(req => (req.body as LoginBody).username === "" || (req.body as LoginBody).password === "", [
        (req: Request, res: Response, next: NextFunction) => {  // eslint-disable-line @typescript-eslint/no-unused-vars
            req.flash("bottomRightError", "Username and password are both required");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if(req.body.next)
                res.redirect(`/login?next=${req.body.next}`);  // eslint-disable-line @typescript-eslint/no-unsafe-member-access
            else
                res.redirect("/login");
        }
    ])
    @Use((req: Request, res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        passport.authenticate("local", { failureRedirect: "/login" + (req.body.next ? "?next=" + (req.body.next as string) : "") })(req, res, next);
    })
    async create(@Req req: Request, @Res res: Response, @Body body: { rememberMe?: string, next?: string }){
        const user: User = await this.userRepository.findOneById(req.user.id);
        const now = new Date();
        if(body.rememberMe && body.rememberMe === "true"){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;  // 30 days
            user.rememberCreatedAt = now;
        }
        user.lastLoginAt = now;
        await this.userRepository.save(user);
        req.flash("bottomRightSuccess", "Successfully logged in");
        if(body.next)
            res.redirect(body.next);
        else
            res.redirect("/");
    }

    @Delete()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => !req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightError", "You havn't logged in yet");
        res.sendStatus(204);
    }])
    async destroy(@Req req: Request, @Res res: Response){
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        req.logout(err => {
            req.flash("bottomRightSuccess", "Successfully logged out");
            res.sendStatus(204);
        });
    }

}
