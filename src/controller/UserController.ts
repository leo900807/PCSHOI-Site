import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Patch, Req, Res, Body } from "@reflet/express";
import { UseIf } from "@reflet/express-middlewares";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { User } from "../entity/User";
import { isLoggedIn, errorGet, errorSet } from "../helper/AppHelper";
import { usernameValidator,
         passwordValidator,
         repasswordValidator,
         nicknameValidator,
         realnameValidator,
         emailValidator,
         oldpasswordValidator,
         newpasswordValidator,
         renewpasswordValidator,
         expireSessions } from "../helper/UserHelper";
import { compare, encrypt } from "../helper/PasswordHelper";

type RegistrationForm = {
    _csrf?: string;
    username?: string;
    password?: string;
    repassword?: string;
    nickname?: string;
    realname?: string;
    email?: string;
};

type EditForm = {
    _csrf: string;
    oldpassword?: string;
    newpassword?: string;
    renewpassword?: string;
    nickname?: string;
    email?: string;
};

@Router("/users")
export class UserController extends AppController{

    private readonly userRepository = AppDataSource.getRepository(User);

    @Get()
    @Use(isLoggedIn)
    async show(@Req req: Request, @Res res: Response){
        const user: User = await this.userRepository.findOneById(req.user.id);
        res.locals.pageTitle = "User info";
        res.render("user/show.ejs", user);
    }

    @Get("/new")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightError", "Please logout before register a new user");
        res.redirect("/");
    }])
    async new(@Req req: Request, @Res res: Response){
        const { error, data } = errorGet(req, "registration error", "registration data");
        res.locals.registrationError = error;
        res.locals.pageTitle = "New user";
        res.render("user/new.ejs", data);
    }

    @Post()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @UseIf(req => req.isAuthenticated(), [(req: Request, res: Response, next: NextFunction) => {
        req.flash("bottomRightError", "Please logout before register a new user");
        res.redirect("/");
    }])
    @Use(usernameValidator)
    @Use(passwordValidator)
    @Use(repasswordValidator)
    @Use(nicknameValidator)
    @Use(realnameValidator)
    @Use(emailValidator)
    async create(@Req req: Request, @Res res: Response, @Body body: RegistrationForm){
        if(errorSet(req, "registration error", "registration data", JSON.stringify(body)))
            return res.redirect(303, "/users/new");
        const isDup = await this.isDuplicate(body.username, body.email, false);
        if(isDup){
            req.flash("registration error", ["Username or email is already used"].toString());
            req.flash("registration data", JSON.stringify(body));
            return res.redirect(303, "/users/new");
        }
        const user = new User();
        user.username = body.username;
        user.nickname = body.nickname;
        user.encryptedPassword = await encrypt(body.password);
        user.realname = body.realname;
        user.email = body.email;
        user.lastLoginAt = new Date();
        await this.userRepository.save(user);
        req.logIn(user, err => {  // eslint-disable-line @typescript-eslint/no-unused-vars
            req.flash("bottomRightSuccess", "Successfully registered a new user");
            res.redirect("/");
        });
    }

    @Get("/edit")
    @Use(isLoggedIn)
    async edit(@Req req: Request, @Res res: Response){
        const user: User = await this.userRepository.findOneById(req.user.id);
        const { error, data } = errorGet(req, "edit user error", "edit user data");
        res.locals.editUserError = error;
        res.locals.pageTitle = "Edit user";
        if(error.length > 0)
            res.render("user/edit.ejs", data);
        else
            res.render("user/edit.ejs", user);
    }

    @Patch()
    @Use(isLoggedIn)
    @Use(oldpasswordValidator)
    @Use(newpasswordValidator)
    @Use(renewpasswordValidator)
    @Use(nicknameValidator)
    @Use(emailValidator)
    async update(@Req req: Request, @Res res: Response, @Body body: EditForm){
        if(errorSet(req, "edit user error", "edit user data", JSON.stringify(body)))
            return res.sendStatus(422);
        const user: User = await this.userRepository.findOneById(req.user.id);
        const isDup = await this.isDuplicate(user.username, body.email, true);
        if(isDup){
            req.flash("edit user error", "Email is already used");
            req.flash("edit user data", JSON.stringify(body));
            return res.redirect(303, "/users/new");
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        compare(body.oldpassword, user.encryptedPassword).then(async result => {
            user.nickname = body.nickname;
            if(body.newpassword.length > 0)
                user.encryptedPassword = await encrypt(body.newpassword);
            user.email = body.email;
            await this.userRepository.save(user);
            if(body.newpassword.length === 0){
                req.flash("bottomRightSuccess", "User data was successfully updated");
                return res.json({ status: 200, redirectUri: "/users" });
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expireSessions(req.session.passport.user, req.sessionID).then(() => {
                req.logOut(err => {  // eslint-disable-line @typescript-eslint/no-unused-vars
                    req.flash("bottomRightSuccess", "User data was successfully updated<br>Please login again");
                    res.json({ status: 200, redirectUri: "/" });
                });
            }).catch(err => console.error(err));
        }).catch(err => {
            if(err === "Password Error"){
                req.flash("edit user error", "Old password is incorrect");
                req.flash("edit user data", JSON.stringify(body));
                res.sendStatus(422);
            }
            else
                console.error(err);
        });
    }

    private async isDuplicate(username: string, email: string, edit: boolean){
        const users: User[] = await this.userRepository.find({ where: [{ username: username }, { email: email }] });
        if(!edit)
            return users.length ? true : false;
        else{
            for(const user of users)
                if(user.username !== username && user.email === email)
                    return true;
            return false;
        }
    }

}
