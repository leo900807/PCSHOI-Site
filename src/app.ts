import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as session from "express-session";
import * as errorHandler from "errorhandler";
import { AppDataSource } from "./data-source";
import { register } from "@reflet/express";
import flash = require("connect-flash");
import * as redis from "redis";
import * as connectRedis from "connect-redis";
import * as bodyParser from "body-parser";
import * as engine from "ejs-mate";
import * as path from "path";
import * as logger from "morgan";
import * as fs from "fs";
import * as passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import * as AdminJSExpress from "@adminjs/express";
import * as TypeormAdapter from "@adminjs/typeorm";
import * as csurf from "csurf";
import AdminJS from "adminjs";
import "dotenv/config";

// controllers
import { IndexController } from "./controller/IndexController";
import { SessionController } from "./controller/SessionController";
import { UserController } from "./controller/UserController";
import { ArticleController } from "./controller/ArticleController";
import { PastexamController } from "./controller/PastexamController";
import { AttachmentController } from "./controller/AttachmentController";
import { ForgotpwdController } from "./controller/ForgotpwdController";
import { RegistrationController } from "./controller/RegistrationController";
import { AboutController } from "./controller/AboutController";

// entities
import { User } from "./entity/User";
import { Article } from "./entity/Article";
import { AdminUser } from "./entity/AdminUser";
import { Pastexam } from "./entity/Pastexam";
import { Attachment } from "./entity/Attachment";
import { Registration } from "./entity/Registration";

// helpers
import { compare } from "./helper/PasswordHelper";
import { REGISTRATION_METADATA_DEFAULT,
         REGISTRATION_METADATA_FULLPATH } from "./helper/RegistrationHelper";

AdminJS.registerAdapter(TypeormAdapter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
AppDataSource.initialize().then(async connection => {

    const app = express();

    // setup logger
    let accessLogStream;
    const logDirectory = path.join(__dirname, "../log");
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
    if(process.env.NODE_ENV === "development"){
        accessLogStream = fs.createWriteStream(path.join(logDirectory, "development.log"), { flags: "a" });
        app.use(logger("dev", { stream: accessLogStream }));
        app.use(errorHandler({ dumpExceptions: true, showStack: true }));
    }
    else{
        accessLogStream = fs.createWriteStream(path.join(logDirectory, "production.log"), { flags: "a" });
        app.use(logger("common", { stream: accessLogStream }));
        app.use(errorHandler());
    }

    // setup registration metadata file
    if(!fs.existsSync(REGISTRATION_METADATA_FULLPATH)){
        fs.writeFileSync(REGISTRATION_METADATA_FULLPATH, JSON.stringify(REGISTRATION_METADATA_DEFAULT));
    }

    // setup ejs engine
    app.engine("ejs", engine);
    app.set("views", path.join(__dirname, "view"));
    app.set("view engine", "ejs");

    // setup path of static assets
    app.use(express.static(path.join(__dirname, "public")));

    // setup redis
    const redisStore = await connectRedis(session);
    const redisClient = await redis.createClient({ url: `redis://${process.env.REDIS_HOST || "localhost:6379"}`, legacyMode: true });
    await redisClient.connect().catch(console.error);
    await redisClient.flushDb();

    // setup admin page
    const resourceOptions = { parent: { name: "Database" } };
    const adminjs = new AdminJS({
        resources: [
            { resource: User, options: { ...resourceOptions, properties: { username: { isTitle: true } }, listProperties: ["username", "nickname", "realname", "email", "admin", "lastLoginAt", "createdAt", "updatedAt"] } },
            { resource: Article, options: { ...resourceOptions, properties: { content: { type: "textarea" } } } },
            { resource: AdminUser, options: resourceOptions },
            { resource: Pastexam, options: resourceOptions },
            { resource: Attachment, options: resourceOptions },
            { resource: Registration, options: resourceOptions }
        ],
        branding: {
            companyName: "PCSHOI Site Admin Page"
        }
    });
    // @ts-ignore TS2339
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminjs, {
        authenticate: async(email: string, password: string) => {
            const adminUserRepository = await AppDataSource.getRepository(AdminUser);
            const adminUser: AdminUser = await adminUserRepository.findOneBy({ email: email || "" });
            if(!adminUser)
                return false;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            return compare(password, adminUser.encryptedPassword).then(result => {
                return { email: email, password: password };
            }).catch(err => {  // eslint-disable-line @typescript-eslint/no-unused-vars
                return false;
            });
        },
        cookiePassword: process.env.SECRET
    }, null, {
        store: new redisStore({ client: redisClient }),
        saveUninitialized: false,
        resave: false,
    });
    app.use(adminjs.options.rootPath, adminRouter);

    // setup session
    app.use(session({
        secret: process.env.SECRET,
        store: new redisStore({ client: redisClient }),
        saveUninitialized: false,
        resave: false
    }));

    // setup flash
    app.use(flash());

    // setup passport
    app.use(passport.initialize());
    app.use(passport.session());

    // setup login
    passport.use(new LocalStrategy({ passReqToCallback: true }, async(req: Request, username: string, password: string, done) => {
        const userRepository = await AppDataSource.getRepository(User);
        const user: User = await userRepository.findOneBy({ username: username });
        if(!user){
            req.flash("bottomRightError", "Invalid username or password");
            done(null, false);
            return
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        await compare(password, user.encryptedPassword).then(result => {
            req.flash("bottomRightSuccess", "Successfully logged in");
            done(null, user);
        }).catch(err => {  // eslint-disable-line @typescript-eslint/no-unused-vars
            req.flash("bottomRightError", "Invalid username or password");
            done(null, false);
        });
    }));

    passport.serializeUser((user: User, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async(id: number, done) => {
        const userRepository = AppDataSource.getRepository(User);
        const user: User = await userRepository.findOneById(id);
        done(null, user);
    });

    // setup header
    app.use((req: Request, res: Response, next: NextFunction) => {
        if(req.isAuthenticated()){
            const user = req.user;
            res.locals.loggedInUsername = user.username;
            res.locals.loggedInNickname = user.nickname;
            res.locals.isAdmin = user.admin;
        }
        next();
    });

    // setup body parser
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // setup global flash
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.flashError = req.flash("error");
        res.locals.flashSuccess = req.flash("success");
        res.locals.flashInfo = req.flash("info");
        res.locals.flashBottomRightError = req.flash("bottomRightError");
        res.locals.flashBottomRightSuccess = req.flash("bottomRightSuccess");
        res.locals.flashBottomRightInfo = req.flash("bottomRightInfo");
        next();
    });

    // setup csrf protection
    const csrfProtection = csurf();
    app.use(csrfProtection);
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.csrfToken = req.csrfToken();
        next();
    });

    // register routers
    register(app, [
        IndexController,
        SessionController,
        UserController,
        ArticleController,
        PastexamController,
        AttachmentController,
        ForgotpwdController,
        RegistrationController,
        AboutController
    ]);

    // handle not found
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use("*", (req: Request, res: Response, next: NextFunction) => {
        next("Not Found");
    });

    // handle errors
    if(process.env.NODE_ENV)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err, req: Request, res: Response, next: NextFunction) => {
            res.locals.pageTitle = "Error";
            if(err === "Not Found")
                res.render("error/404.ejs");
            else if(err.code && err.code === "EBADCSRFTOKEN") // eslint-disable-line @typescript-eslint/no-unsafe-member-access
                res.sendStatus(400);
            else if(process.env.NODE_ENV === "production")
                res.render("error/500.ejs");
            else
                res.status(500).send(err);
        });

    app.listen(process.env.PORT || 3000);

    console.log(`Express server has started on port ${process.env.PORT || 3000}.`);

}).catch(err => console.error(err));
