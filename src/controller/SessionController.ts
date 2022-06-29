import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Delete, Req, Res, Body } from "@reflet/express";
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
    async new(@Res res: Response){
        res.locals.pageTitle = "Login";
        res.render("session/new.ejs");
    }

    @Post()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightSuccess", "You have already logged in");
        res.redirect("/");
    }])
    @UseIf(req => (req.body as LoginBody).username === "" || (req.body as LoginBody).password === "", [
        (req: Request, res: Response, next: NextFunction) => {  // eslint-disable-line @typescript-eslint/no-unused-vars
            req.flash("bottomRightError", "Username and password are both required");
            res.redirect("/login");
        }
    ])
    @Use(passport.authenticate("local", { failureRedirect: "/login" }))
    async create(@Req req: Request, @Res res: Response, @Body("rememberMe") rememberMe?: string){
        const user: User = await this.userRepository.findOneById(req.user.id);
        if(rememberMe && rememberMe === "true"){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;  // 30 days
            user.rememberCreatedAt = new Date();
        }
        user.lastLoginAt = new Date();
        await this.userRepository.save(user);
        req.flash("bottomRightSuccess", "Successfully logged in");
        res.redirect("/");
    }

    @Delete()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => !req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightError", "You havn't logged in yet");
        res.redirect("/");
    }])
    async destroy(@Req req: Request, @Res res: Response){
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        req.logout(err => {
            req.flash("bottomRightSuccess", "Successfully logged out");
            res.json({ status: 200, redirectUri: "/" });
        });
    }

}
