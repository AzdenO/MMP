import {generateToken} from "./utils/cryptography.mjs";
import dayjs from "dayjs";

export default class UserPool{

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(){
        this.pool = {};

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    appendUser(obj){
        console.log("User Pool:// Checking for pre-existing entry in pool");
        if(this.checkForUser(obj)){
            console.log("User Pool:// User already exists, resetting entry expiry");
            this.pool[obj.getDisplayName()].expires = dayjs().add(3600,"seconds").format("YYYY-MM-dd HH:mm:ss");
        }else{
            console.log("User Pool:// Appending "+obj.getDisplayName()+" to pool");
            this.pool[obj.getDisplayName()] = {
                coach: obj,
                expires: dayjs().add(3600,"seconds").format("YYYY-MM-dd HH:mm:ss")
            }
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to find a matching coach object with the provided user id, and pass the arguments and coach object onto the
     * execute method
     * @param {string} userid The bungie display name tied to a coach object
     * @param {int} reqCode The code which maps in the execute method to a specific coach function to call
     * @param {string[]} args Any arguments necessary for this type of request
     * @returns {Promise<*>}
     */
    process(userid, reqCode, args){
        const match = this.pool[userid];
        if(typeof match === "undefined"){
            console.log("User Pool:// No entry found for "+userid);
            throw new InvalidTokenError();
        }
        console.log("User Pool:// Found active entry for "+userid);
        return this.#execute(match.coach,reqCode,args);

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    async #execute(coach, reqCode, args){
        console.log("User Pool:// Executing request");
        switch(reqCode){
            case 1:
                return coach.get_suggestions_by_activity(args[0],args[1]);
                break;
            case 2:
                return await coach.getWeaponSkillsContent(args[0]);
                break;
            case 3:
                 return await coach.getCharacterAnalysis(args[0]);
                 break;
            case 4:
                return await coach.getRecentActivities(args[0]);
                break;
            default:
                break;
        }

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Check if an entry already exists in the pool for this user
     * @param {coach} obj
     * @returns {boolean} indicating existance of user in pool
     */
    checkForUser(obj){
        if(this.pool.hasOwnProperty(obj.getDisplayName())){
            return true;
        }
        return false;
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    deleteEntryAfterExpiry(){

    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////
}