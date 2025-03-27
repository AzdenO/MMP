import {generateToken} from "./utils/cryptography.mjs";
import {InvalidTokenError} from "./utils/errors.mjs";
import dayjs from "dayjs";

export default class UserPool{

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(){
        this.pool = [];

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    refreshUserAccess(refreshToken){
        console.log("User Pool:// Mapping refresh token to user");
        const match = this.pool.find(user => user.coach.getRefreshToken() === refreshToken);
        if(typeof match === "undefined"){
            throw new InvalidTokenError();
        }
        const newToken = generateToken();
        match.accessToken = newToken;
        match.expires = dayjs().add(3600,"seconds").format("YYYY-MM-dd HH:mm:ss");
        console.log("User Pool:// New token generated for user "+match.coach.getDisplayName());
        return newToken;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    appendUser(obj){
        console.log("User Pool:// Generating access token and appending user to pool")
        const token = generateToken();
        this.pool.push(
            {
                accessToken: token,
                coach: obj,
                expires: dayjs().add(3600,"seconds").format("YYYY-MM-dd HH:mm:ss")
            }
        );
        return token;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    process(token, reqCode, args){
        const match = this.pool.find(coach => coach.accessToken === token);
        if(typeof match === "undefined"){
            throw new InvalidTokenError();
        }
        return this.#execute(match.coach,reqCode,args);

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    #execute(coach, reqCode, args){

        switch(reqCode){
            case 1:
                return coach.get_suggestions_by_activity(args[0],args[1]);
                break;
            default:
                break;
        }

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /*
    * CHECK FOR PRE-EXISTING COACH OBJECT IN POOL
    * This method serves a roll in authentication. If a user re-authorises such as through a webpage refresh
    * there will most likely still be a coach object corresponding to the user. We find that object, replace it
    * and issue a new refresh token. If one does not exist, it simply calls appendUser using the passed in coach
    * object
    */
    checkForUser(obj){

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
}