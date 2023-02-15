import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Patch, Req, Res, Next, Body, Query } from "@reflet/express";
import { UseIf } from "@reflet/express-middlewares";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { User } from "../entity/User";
import { errorGet, errorSet } from "../helper/AppHelper";
import { usernameValidator, emailValidator, tokenGen } from "../helper/ForgotpwdHelper";
import { newpasswordValidator, renewpasswordValidator, expireSessions } from "../helper/UserHelper";
import { encrypt } from "../helper/PasswordHelper";
import { sendMail } from "../helper/MailingHelper";

type ForgotpwdForm = {
    _csrf?: string;
    username?: string;
    email?: string;
};

type ResetpwdForm = {
    _csrf?: string;
    token: string;
    newpassword?: string;
    renewpassword?: string;
};

@Router("/forgotpwd")
export class ForgotpwdController extends AppController{

    private readonly userRepository = AppDataSource.getRepository(User);

    @Get()
    async new(@Req req: Request, @Res res: Response){
        if(req.isAuthenticated()){
            req.flash("bottomRightError", "You are now logged in");
            return res.redirect("/");
        }
        const { error, data } = errorGet(req, "forgot password error", "forgot password data");
        res.locals.forgotPasswordError = error;
        res.locals.pageTitle = "Forgot Password";
        res.render("forgotpwd/new.ejs", data);
    }

    @Post()
    @Use(usernameValidator)
    @Use(emailValidator)
    async create(@Req req: Request, @Res res: Response, @Body body: ForgotpwdForm){
        if(errorSet(req, "forgot password error", "forgot password data", JSON.stringify(body)))
            return res.redirect(303, "/forgotpwd");
        const user: User = await this.userRepository.findOneBy({ username: body.username, email: body.email });
        if(!user){
            req.flash("forgot password error", "No such user or the email is not matched");
            req.flash("forgot password data", JSON.stringify(body));
            return res.redirect(303, "/forgotpwd");
        }
        user.resetPasswordToken = tokenGen();
        user.resetPasswordTokenSentAt = new Date();
        await this.userRepository.save(user);
        await sendMail({
            to: user.email,
            subject: "Reset password for PCSHOI Site",
            html: this.mailContent(user)
        });
        req.flash("bottomRightSuccess", "Reset password mail is sent");
        res.redirect("/");
    }

    @Get("/resetpwd")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightSuccess", "Please logout before resetting password");
        res.redirect("/");
    }])
    async edit(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Query("token") token?: string){
        const user: User = await this.userRepository.findOneBy({ resetPasswordToken: token || "" });
        const { error } = errorGet(req, "reset password error", "reset password data");
        if(!user || this.isTokenExpired(user))
            return next("Not Found");
        res.locals.resetPasswordError = error;
        res.locals.pageTitle = "Reset Password";
        res.render("forgotpwd/edit.ejs", { token: user.resetPasswordToken });
    }

    @Patch("/resetpwd")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightSuccess", "Please logout before resetting password");
        res.redirect("/");
    }])
    @Use(newpasswordValidator)
    @Use(renewpasswordValidator)
    async update(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Body body: ResetpwdForm){
        if(errorSet(req, "reset password error", "reset password data", JSON.stringify(body)))
            return res.sendStatus(422);
        const user: User = await this.userRepository.findOneBy({ resetPasswordToken: body.token || "" });
        if(!user || this.isTokenExpired(user))
            return next("Not Found");
        user.encryptedPassword = await encrypt(body.newpassword);
        user.resetPasswordToken = null;
        user.resetPasswordTokenSentAt = null;
        await this.userRepository.save(user);
        expireSessions(user.id, req.sessionID).then(() => {
            req.flash("bottomRightSuccess", "Password was successfully updated");
            res.json({ status: 200, redirectUri: "/" });
        }).catch(err => console.error(err));
    }

    private mailContent(user: User){
        return `<h1>Reset password</h1>
        <p>You "${user.nickname} (${user.username})" just requested to reset your password for <a href="${process.env.WEBSITE_ROOT_URI}" target="_blank">PCSHOI Site</a>.</p>
        <p>If you never sent the request, please ignore this mail.</p>

        <p>Please click <a href="${process.env.WEBSITE_ROOT_URI}/forgotpwd/resetpwd?token=${user.resetPasswordToken}">here</a> or use the following link to reset your password.</p>
        <p>If you request a new link, the old link will expire.</p>
        <p><strong><font color="red">This link will expire in 1 hour.</font></strong></p>

        <p>Reset password link: <a href="${process.env.WEBSITE_ROOT_URI}/forgotpwd/resetpwd?token=${user.resetPasswordToken}">${process.env.WEBSITE_ROOT_URI}/forgotpwd/resetpwd?token=${user.resetPasswordToken}</a></p>
        <br>
        <p>Best regards,<br>
        PCSHOI Site</p>`;
    }

    private isTokenExpired(user: User){
        return Date.now() - user.resetPasswordTokenSentAt.getTime() > 60 * 60 * 1000;  // 1 hrs
    }

}
