import crypto from "crypto";

/////////////////////////////////////////////////////////////////////////////////////////
function decryptToken(token){

}
/////////////////////////////////////////////////////////////////////////////////////////
function encryptToken(token){

}
/////////////////////////////////////////////////////////////////////////////////////////
export function generateToken(){
    return crypto.randomBytes(192).toString("base64");
}
/////////////////////////////////////////////////////////////////////////////////////////
export const secretiser = {
    decryptToken,
    encryptToken,
}
/////////////////////////////////////////////////////////////////////////////////////////