import * as bcrypt from "bcrypt";

export async function encrypt(password: string): Promise<string|null>{
    return await new Promise((resolve, reject) => {
        bcrypt.genSalt(10, (err, Salt) => {
            bcrypt.hash(password, Salt, (err, hash) => {
                if(err){
                    console.error("It occurs some errors when encrypting");
                    reject(err);
                }
                resolve(hash);
            });
        });
    });
}

export async function compare(password: string, encryptedPassword: string): Promise<string>{
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, encryptedPassword, (err, same) => {
            same ? resolve("") : reject("Password Error");
        });
    });
}
