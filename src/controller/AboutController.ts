import { Response } from "express";
import { Router, Get, Res } from "@reflet/express";
import { AppController } from "./AppController";

@Router("/about")
export class AboutController extends AppController{

    @Get()
    async index(@Res res: Response){
        res.locals.pageTitle = "About";
        res.render("about/index.ejs");
    }

}
