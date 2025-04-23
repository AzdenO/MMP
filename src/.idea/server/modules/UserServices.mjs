/**
 * @module UserServices
 * @description Module to encapsulate fetching of data from the database and bungie, as well as setting some data in the database.
 * This module is only ever called from the coach, and a single call on index.mjs to fetch the games knowledge base to abstract
 * away other modules
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth (drw8)
 */
import * as fs from "node:fs";//accessing machine file system
import cron from "node-cron"; //for scheduling methods to execute at specific times, such as the weekly data update

var db = null;//database dependency
var destiny = null;//bungie access dependency
var DEBUG = false;//modules DEBUG status, used for testing

import {seperateItems} from "./utils/listUtils.js";//method to seperate items fetch from bungie into arrays of their subtypes
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
 * Method to fetch from bungie access an activity summary that maps to the passed instance id
 * @param {string} instanceid The hash value that maps to an activity instance on the bungie API
 * @param {string} characterid The character the player played as for this activity, this character must have been present
 * for this activity, otherwise this function will fail and throw an error
 * @returns {Promise<Object>} The parsed activity summary
 */
async function getActivitySummary(instanceid,characterid){
    const summary = await destiny.getActivitySummary(
        instanceid,
        characterid
    )
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Fetch the players weapon statistics for all weapon types
 * @param {string} userid The player to request data for
 * @returns {Promise<Object>} The statistics object
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
 * @returns {Promise<Object>}
 */
async function getCoachData(userid){
    const data =  await db.getProgressionData(userid);
    return data;

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromBungie(code){
    return await destiny.getNewUser(code);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromDB(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to update all user data that requires resetting every week, such as weekly progress tracking stats
 */
async function weeklyUpdate(){
    console.log("User Services (Async): Starting weekly update");
    const userids = await db.getAllUsers();
    for(const userid of userids){
        const requestParams = await db.getBungieRequestData(userid);
        const newData = await destiny.getHistoricalStats(
            requestParams.token,
            requestParams.platformid,
            requestParams.platformtype
        )
        db.updateProgressionData(userid, newData);
    }
    //schedule this job to occur again on tuesday every week at 18:05
    cron.schedule(
        "5 18 * * 2",
        weeklyUpdate
    );
    console.log("User Services (Async): Weekly update complete");
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
    console.log("User Services:// Scheduling weekly update");
    cron.schedule(
        "5 18 * * 2",
        weeklyUpdate
    )
    console.log("User Services:// Initialisation complete");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default {
    getUserItems,
    getWeaponStats,
    getCharacterConfiguration,
    getRecentActivities,
    getKnowledgeBase,
    getCoachData,
    weeklyUpdate,
    initialise
}
