import { google } from "googleapis";
import { GetAccessTokenResponse } from "google-auth-library/build/src/auth/oauth2client";
import { createTransport, SendMailOptions } from "nodemailer";
import { SmtpOptions } from "nodemailer-smtp-transport";

async function getAccessToken(){
    const OAuth2Client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
    OAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    let token: GetAccessTokenResponse | null = null;
    try{
        token = await OAuth2Client.getAccessToken();
    }
    catch(err){
        console.error("Refresh token was expired");
    }
    return token;
}

async function getMailer(){
    const accessToken = await getAccessToken();
    if(!accessToken)
        return null;
    return createTransport({
        service: "Gmail",
        auth: {
            type: "OAuth2",
            user: process.env.GMAIL_ACCOUNT,
            clientId: process.env.GMAIL_CLIENT_ID,
            clientSecret: process.env.GMAIL_CLIENT_SECRET,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN,
            accessToken: accessToken.token
        }
    } as SmtpOptions);
}

export async function sendMail(mailOptions: SendMailOptions){
    const mailer = await getMailer();
    if(!mailer){
        console.error(`Unable to send mail to ${mailOptions.to}`);
        return;
    }
    mailer.sendMail(mailOptions, (err, info) => {  // eslint-disable-line @typescript-eslint/no-unused-vars
        if(err)
            console.error(`Unable to send mail to ${mailOptions.to}: ${err}`);
        else
            console.log(`Successfully sent to ${mailOptions.to}`);
    });
}
