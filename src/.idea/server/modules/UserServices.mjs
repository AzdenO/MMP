/**
 * @module UserServices
 * @description Module to encapsulate fetching of data from the database and bungie, as well as setting some data in the database
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth
 */
import * as fs from "node:fs";

var db = null;
var destiny = null;
var DEBUG = false;

import {seperateItems} from "./utils/listUtils.js";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 *
 * @param userItems A two, dimensional array of x-len 2, index 0 representing armors and index 1 being weapons. This function
 * expects this array to be sorted before hand into the seperate item denominations
 * @param userid The user id (bungie display name) we are storing these items for
 * @returns {Promise<void>} does not return anything, utilises asynchronous methods, option to await this function may
 * be of use in future
 */
async function sendItemsToDatabase(userItems, userid){
    console.log("User Services (Async): Storing Weapons");
    for(var weapon in userItems[1]){
        await db.storeItem(
            [userItems[1][weapon].instance,
            userItems[1][weapon].itemId.toString(),
            userid,
            userItems[1][weapon].name,
            userItems[1][weapon].power.toString(),
            userItems[1][weapon].item_type,
            userItems[1][weapon].damage,
            JSON.stringify(userItems[1][weapon].stats),
            JSON.stringify(userItems[1][weapon].perks)],
            "Weapon");
    }
    console.log("User Services (Async): Storing Armors");
    for(var armor in userItems[0]){
        await db.storeItem(
            [
                userItems[0][armor].instance,
                userItems[0][armor].itemId,
                userid,
                userItems[0][armor].name,
                userItems[0][armor].power.toString(),
                userItems[0][armor].item_type,
                JSON.stringify(userItems[0][armor].stats),
                JSON.stringify(userItems[0][armor].perks)
            ],"Armor"
        )
    }
    console.log("User Services (Async): All items stored sucessfully");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Fetch the players weapon statistics for all weapon types
 * @param {string} userid The player to request data for
 * @returns {Promise<Object>}
 */
async function getWeaponStats(userid,pve){
    const requestParams = await db.getBungieRequestData(userid)
    const content = await destiny.getAccountWeaponStats(
        requestParams.platformid,
        requestParams.platformtype,
        requestParams.token,
        pve
    );
    return content;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getCharacterConfiguration(userid, characterid){
    const requestParams = await db.getBungieRequestData(userid);
    const items = await destiny.getCharacterItems(
        characterid,
        requestParams.platformid,
        requestParams.platformtype,
        requestParams.token,
        true
    )
    const seperated = seperateItems(items);
    return {
        Weapons: seperated[1],
        Armors: seperated[0],
        Subclasses: seperated[2],
    }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Fetch the players 30 most recent activities
 * @param {string} userid The player we are fetching activities for
 * @param {string} characterid The players character to fetch activities for
 * @returns {Promise<Array>}
 */
async function getRecentActivities(userid,characterid){
    const requestParams = await db.getBungieRequestData(userid);
    const reports = await destiny.getAccountActivityReports(
        requestParams.platformid,
        requestParams.platformtype,
        characterid,
        requestParams.token,
        0,
        30
    )
    return reports;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to read the knowledge base from a file, parse it, and return
 * @returns {Object} The knowledge base object
 */
function getKnowledgeBase(){
    const read = fs.readFileSync("O://Dev/Level4/VanguardMentorServer/src/.idea/server/resources/knowledge.json", "utf8");
    return json.parse(read);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getUserItems(userid){
    const result = await db.getUserItems(userid);

    const weapons= [result[0]];
    const armors = [result[1]];


}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to return basic coaching data about the player that is stored in the database
 * @param {string} userid The user to return this data for
 * @returns {Promise<void>}
 */
async function getCoachData(userid){
    const requestParams = await db.getBungieRequestData(userid);

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromBungie(code){
    return await destiny.getNewUser(code);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromDB(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function injectDependencies(bungie,database){
    destiny = bungie;
    db = database;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function initialise(destiny,database){
    console.log("User Services:// Initialising Service");
    injectDependencies(destiny,database);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default {
    getUserItems,
    getWeaponStats,
    getCharacterConfiguration,
    getRecentActivities,
    getKnowledgeBase,
    getCoachData,
    initialise
}

export const authServices = {
    getPlayerFromBungie,
    getPlayerFromDB
}