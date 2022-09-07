import { Request, Response, NextFunction } from "express";
import { Router, Use, Get, Post, Patch, Delete, Req, Res, Next, Body, Query, Params } from "@reflet/express";
import { validationResult } from "express-validator";
import { AppDataSource } from "../data-source";
import { AppController } from "./AppController";
import { Registration } from "../entity/Registration";
import { User } from "../entity/User";
import { isLoggedIn, isAdmin, adjustTimeString, checkIdValid, isPositiveInteger, errorGet, errorSet } from "../helper/AppHelper";
import { RegistrationMetadata,  // eslint-disable-line @typescript-eslint/no-unused-vars
         ScoreRank,
         tmpDirectory,
         uploadFile,
         yearOfContestValidator,
         registerStartValidator,
         registerEndValidator,
         studentIdValidator,
         classSeatValidator,
         passwordValidator,
         repasswordValidator,
         newpasswordValidator,
         renewpasswordValidator,
         getRegistrationMetadata,
         setRegistrationMetadata,
         scoreRankChecker,
         transScoreRank } from "../helper/RegistrationHelper";
import { encrypt } from "../helper/PasswordHelper";
import { sendMail } from "../helper/MailingHelper";
import ObjectsToCsv = require("objects-to-csv");
import CsvParser = require("csv-parser");
import * as path from "path";
import * as fs from "fs";

type RegistrationForm = {
    _csrf?: string;
    yearofcontest?: string;
    studentid?: string;
    classseat?: string;
    password?: string;
    repassword?: string;
};

type RegistrationEditForm = {
    _csrf?: string;
    newpassword?: string;
    renewpassword?: string;
};

type RegistrationSettingsForm = {
    _csrf?: string;
    yearofcontest?: string;
    registerstart?: string;
    registerend?: string;
};

type RegistrationIndexFilter = {
    _csrf?: string;
    yearofcontest?: string;
};

@Router("/register")
export class RegistrationController extends AppController{

    private readonly registrationRepository = AppDataSource.getRepository(Registration);

    @Get("/index")
    @Use(isLoggedIn)
    async index(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Query("year") year?: string){
        if(!req.user.admin){
            const registrations: Registration[] = await this.registrationRepository.find({ where: { registrantId: req.user.id }, order: { createdAt: "ASC" } });
            res.locals.pageTitle = "Registration history";
            return res.render("registration/index.ejs", { registrations });
        }
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        const data = req.flash("registration index data");
        if(data.length)
            res.locals.yearOfContest = (JSON.parse(data[0]) as RegistrationIndexFilter).yearofcontest;
        let nowOnYear: number;
        if(!year)
            nowOnYear = metadata.yearOfContest;
        else if(isPositiveInteger(year))
            nowOnYear = Number(year);
        else
            return next("Not Found");
        const registrations: Registration[] = await this.registrationRepository.find({ where: { registerYear: nowOnYear }, relations: { registrant: true }, order: { createdAt: "ASC" } });
        res.locals.pageTitle = "Registration list";
        res.locals.nowOnYear = nowOnYear;
        res.render("registration/index.ejs", { registrations });
    }

    @Post("/index")
    @Use(isAdmin)
    @Use(yearOfContestValidator)
    async postIndex(@Req req: Request, @Res res: Response, @Body body: RegistrationIndexFilter){
        const error = validationResult(req);
        if(!error.isEmpty()){
            req.flash("bottomRightError", error.array()[0].msg);
            req.flash("registration index data", JSON.stringify(body));
            return res.redirect(303, "/register/index");
        }
        res.redirect(303, `/register/index?year=${body.yearofcontest}`);
    }

    @Get("/new")
    @Use(isLoggedIn)
    async new(@Req req: Request, @Res res: Response){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        const pastRegistration: Registration = await this.registrationRepository.findOneBy({ registrantId: req.user.id, registerYear: metadata.yearOfContest });
        if(pastRegistration){
            req.flash("bottomRightError", "You've already registered for contest this year");
            return res.redirect("/register");
        }
        if(!this.isDuringRegistration(metadata)){
            req.flash("bottomRightError", "It's not registration phase");
            return res.redirect("/register");
        }
        const { error, data } = errorGet(req, "contest registration error", "contest registration data");
        res.locals.contestRegistrationError = error;
        res.locals.yearOfContest = metadata.yearOfContest;
        res.locals.pageTitle = "Register for contest";
        res.render("registration/new.ejs", data);
    }

    @Post()
    @Use(isLoggedIn)
    @Use(studentIdValidator)
    @Use(classSeatValidator)
    @Use(passwordValidator)
    @Use(repasswordValidator)
    async create(@Req req: Request, @Res res: Response, @Body body: RegistrationForm){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        const pastRegistration: Registration = await this.registrationRepository.findOneBy({ registrantId: req.user.id, registerYear: metadata.yearOfContest });
        if(pastRegistration){
            req.flash("bottomRightError", "You've already registered for contest this year");
            return res.redirect("/register");
        }
        if(!this.isDuringRegistration(metadata)){
            req.flash("bottomRightError", "It's not registration phase");
            return res.redirect("/register");
        }
        if(errorSet(req, "contest registration error", "contest registration data", JSON.stringify(body)))
            return res.redirect(303, "/register/new");
        const registration = new Registration();
        registration.registrant = req.user;
        registration.studentId = body.studentid;
        registration.classSeat = body.classseat;
        registration.encryptedPassword = await encrypt(body.password);
        registration.verificationCode = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");  // From 000000 to 999999
        registration.registerYear = metadata.yearOfContest;
        await this.registrationRepository.save(registration);
        await sendMail({
            to: req.user.email,
            subject: "Successfully registered for the contest",
            html: this.mailContent(req.user, registration)
        });
        req.flash("bottomRightSuccess", "Successfully registered for contest<br>A mail is sent to your email address<br>Please check your mailbox");
        res.redirect("/register");
    }

    @Get("/edit")
    @Use(isLoggedIn)
    async edit(@Req req: Request, @Res res: Response){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        if(!this.isDuringRegistration(metadata)){
            req.flash("bottomRightError", "It's not registration phase");
            return res.redirect("/register");
        }
        const registration: Registration = await this.registrationRepository.findOneBy({ registrantId: req.user.id, registerYear: metadata.yearOfContest });
        const { error } = errorGet(req, "contest registration edit error", "contest registration edit data");
        if(!registration){
            req.flash("bottomRightError", "You haven't registered yet<br>You can only edit infos after registered");
            return res.redirect("/register");
        }
        res.locals.contestRegistrationEditError = error;
        res.locals.pageTitle = "Edit registration for contest";
        res.render("registration/edit.ejs");
    }

    @Patch()
    @Use(isLoggedIn)
    @Use(newpasswordValidator)
    @Use(renewpasswordValidator)
    async update(@Req req: Request, @Res res: Response, @Body body: RegistrationEditForm){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        if(!this.isDuringRegistration(metadata)){
            req.flash("bottomRightError", "It's not registration phase");
            return res.redirect("/register");
        }
        if(errorSet(req, "contest registration edit error", "contest registration edit data", ""))
            return res.sendStatus(422);
        const registration: Registration = await this.registrationRepository.findOneBy({ registrantId: req.user.id, registerYear: metadata.yearOfContest });
        if(!registration){
            req.flash("bottomRightError", "You haven't registered yet\nYou can only edit infos after registered");
            return res.redirect(303, "/register");
        }
        registration.encryptedPassword = await encrypt(body.newpassword);
        await this.registrationRepository.save(registration);
        req.flash("bottomRightSuccess", "Successfully updated");
        res.json({ status: 200, redirectUri: "/register" });
    }

    @Delete("/:id")
    @Use(isAdmin)
    @Use(checkIdValid)
    async destroy(@Req req: Request, @Res res: Response, @Next next: NextFunction, @Params("id") id: string, @Body body: { verificationcode?: string }){
        const registration: Registration = await this.registrationRepository.findOneById(Number(id));
        if(registration){
            if(body.verificationcode !== registration.verificationCode){
                req.flash("bottomRightError", "Verification Code Error");
                return res.sendStatus(422);
            }
            await this.registrationRepository.remove(registration);
            req.flash("bottomRightSuccess", "Successfully deleted");
            res.json({ status: 200, redirectUri: "/register/index" });
        }
    }

    @Get()
    async show(@Req req: Request, @Res res: Response){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        let registration: Registration;
        if(req.isAuthenticated())
            registration = await this.registrationRepository.findOneBy({ registrantId: req.user.id, registerYear: metadata.yearOfContest });
        if(registration)
            res.locals.registration = registration;
        if(!this.isDuringRegistration(metadata))
            res.locals.isRegistrationPhase = false;
        res.locals.pageTitle = "Register status";
        res.render("registration/show.ejs");
    }

    @Get("/settings")
    @Use(isAdmin)
    async settingsEdit(@Req req: Request, @Res res: Response){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        (metadata.registerStart as unknown as string) = adjustTimeString(metadata.registerStart);
        (metadata.registerEnd as unknown as string) = adjustTimeString(metadata.registerEnd);
        const { error, data }: { error: string[], data: RegistrationSettingsForm } = errorGet(req, "registration settings error", "registration settings data");
        res.locals.registrationSettingsError = error;
        res.locals.pageTitle = "Registration settings";
        if(error.length > 0){
            res.locals.yearOfContest = data.yearofcontest;
            res.locals.registerStart = data.registerstart;
            res.locals.registerEnd = data.registerend;
            res.render("registration/settings.ejs");
        }
        else
            res.render("registration/settings.ejs", metadata);
    }

    @Post("/settings")
    @Use(isAdmin)
    @Use(yearOfContestValidator)
    @Use(registerStartValidator)
    @Use(registerEndValidator)
    async settingsUpdate(@Req req: Request, @Res res: Response, @Body body: RegistrationSettingsForm){
        if(errorSet(req, "registration settings error", "registration settings data", JSON.stringify(body)))
            return res.redirect(303, "/register/settings");
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        metadata.yearOfContest = Number(body.yearofcontest);
        metadata.registerStart = new Date(body.registerstart);
        metadata.registerEnd = new Date(body.registerend);
        await setRegistrationMetadata(metadata);
        req.flash("bottomRightSuccess", "Successfully updated");
        res.redirect("/register");
    }

    @Get("/download")
    @Use(isAdmin)
    async downloadCsv(@Res res: Response, @Next next: NextFunction, @Query("year") year?: string){
        const metadata: RegistrationMetadata = await getRegistrationMetadata();
        let nowOnYear: number;
        if(!year)
            nowOnYear = metadata.yearOfContest;
        else if(isPositiveInteger(year))
            nowOnYear = Number(year);
        else
            return next("Not Found");
        const registrations: (Registration & { email?: string })[] = await this.registrationRepository
            .createQueryBuilder("registration")
            .select([
                "registration.studentId",
                "registration.classSeat",
                "registration.encryptedPassword",
                "registration.verificationCode",
                "registration.registerYear",
                "registration.score",
                "registration.rank",
                "registration.createdAt",
                "registration.updatedAt"
            ])
            .leftJoin("registration.registrant", "registrant")
            .addSelect(["registrant.realname", "registrant.email"])
            .where("registerYear = :registerYear", { registerYear: nowOnYear })
            .orderBy("registration.createdAt", "ASC")
            .getMany();
        registrations.forEach(registration => {
            (registration.createdAt as unknown as string) = adjustTimeString(registration.createdAt);
            (registration.updatedAt as unknown as string) = adjustTimeString(registration.updatedAt);
            (registration.email as unknown as string) = registration.registrant.email;
            (registration.registrant as unknown as string) = registration.registrant.realname;
        });
        const csv = await new ObjectsToCsv(registrations).toString();
        res.writeHead(200, { "Content-Disposition": `attachment; filename="Registration list of ${nowOnYear} year.csv"`, "Content-Type": "text/plain" });
        res.end(Buffer.from(csv, "utf8"));
    }

    @Get("/upload")
    @Use(isAdmin)
    async editScoreRank(@Req req: Request, @Res res: Response){
        res.locals.pageTitle = "Edit score & rank";
        res.render("registration/editScoreRank.ejs");
    }

    @Patch("/upload")
    @Use(isAdmin)
    @Use(uploadFile)
    async updateScoreRank(@Req req: Request, @Res res: Response){
        const data: ScoreRank[] = [];
        if(!req.file){
            req.flash("bottomRightError", "CSV file is required");
            return res.sendStatus(422);
        }
        if(req.file.mimetype !== "text/csv"){
            req.flash("bottomRightError", "Only accept CSV file");
            return res.sendStatus(422);
        }
        fs.createReadStream(path.join(tmpDirectory, req.file.filename)).pipe(CsvParser()).on("data", e => data.push(e)).on("end", async() => {
            fs.unlink(path.join(tmpDirectory, req.file.filename), err => {
                if(err)
                    console.log(err);
            });
            if(!scoreRankChecker(data)){
                req.flash("bottomRightError", "Format of CSV file is wrong");
                return res.sendStatus(422);
            }
            const whereCondition: { registerYear: number, studentId: string }[] = [];
            const dataToUpdate: { [key: string]: { score: number | null, rank: number | null } } = {};
            data.forEach(datum => {
                datum.score = transScoreRank(datum.score as unknown as string);
                datum.rank = transScoreRank(datum.rank as unknown as string);
                dataToUpdate[`${datum.registerYear}${datum.studentId}`] = { score: datum.score, rank: datum.rank };
                datum.registerYear = Number(datum.registerYear as unknown as string);
                whereCondition.push({ registerYear: datum.registerYear, studentId: datum.studentId });
            });
            const registrations: Registration[] = await this.registrationRepository.find({ where: whereCondition });
            registrations.forEach(registration => {
                const updateData = dataToUpdate[`${registration.registerYear.toString()}${registration.studentId}`];
                registration.score = updateData.score;
                registration.rank = updateData.rank;
            });
            await this.registrationRepository.save(registrations);
            req.flash("bottomRightSuccess", "Successfully updated");
            res.json({ status: 200, redirectUri: "/register/index" });
        });
    }

    private isDuringRegistration(metadata: RegistrationMetadata){
        const now = new Date().getTime();
        return metadata.registerStart.getTime() <= now && now <= metadata.registerEnd.getTime();
    }

    private mailContent(user: User, registration: Registration){
        return `<h1>Registration success</h1>
        <p>You "${user.nickname} (${user.username})" just registered as "${user.realname}" for contest of ${registration.registerYear} year.</p>
        <p>Below is your verification code for this registration.</p>
        <br>
        <p><strong>Verification Code:</strong> ${registration.verificationCode}</p>
        <br>
        <p>You can change your password for practice session before the end of registration phase.</p>
        <p>And please keep following <a href="${process.env.WEBSITE_ROOT_URI}">PCSHOI Site</a> to get latest informations.</p>
        <br>
        <p>Best regards,<br>
        PCSHOI Site</p>`;
    }

}
