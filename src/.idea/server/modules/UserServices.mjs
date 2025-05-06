/**
 * @module UserServices
 * @description Module to encapsulate fetching of data from the database and bungie, as well as setting some data in the database.
 * This module is only ever called from the coach, and a single call on index.mjs to fetch the games knowledge base to abstract
 * away other modules
 * @version 0.3.1
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
    return summary;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch the totality of a players activity history from bungie
 * @param {string} userid The user we are fetching this data for
 * @param {string} character The character id (mapping to a character on the bungie api) to fetch activities for
 * @returns {Promise<Object>} The players history
  */
async function getAllPlayerActivityReports(userid,character){
    const params = await db.getBungieRequestData(userid);
    const history = await destiny.getAccountActivityReports(
        params.platformid,
        params.platformtype,
        character,
        params.token,
        0
    )
    return history;
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
 * Function to fetch the items a player has on their character, this excludes what the player has equipped
 * @param {string} userid The user to fetch data for
 * @param {string} characterid The character to fetch the items from
 * @returns {Promise<Object>} Object with a property for each item
 */
async function getCharacterItems(userid,characterid){
    const params = await db.getBungieRequestData(userid);

    const items = destiny.getCharacterItems(
        characterid,
        params.platformid,
        params.platformtype,
        params.token,
        false
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
 * Function to fetch all items a player has stored in their vault
 * @param {string} userid The user to fetch items for
 * @returns {Promise<Array>} An array of all the items found
 */
async function getVaultItems(userid){
    const params = await db.getBungieRequestData(userid)
    const res = await destiny.getVaultItems(
        params.platformid,
        params.platformtype,
        params.token
    );
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
/**
 * Function to retrieve basic player data such as standard path parameters for bungie API requests and characters
 * @param {string} code An OAuth2 code provided by Bungie, sent to the server by a client
 * @returns {Promise<Object>} An object containing basic user details
 */
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
/**
 * Method to fetch a high verbosity object of an activity from an activity hash
 * @param {string} activityHash The activity hash that maps to an activity on the bungie API
 */
function getActivity(activityHash){
    return destiny.getActivity(activityHash);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to inject object dependencies
 * @param {Object} bungie The bungie_access dependency
 * @param {Object} database The user_database dependency
 */
function injectDependencies(bungie,database){
    destiny = bungie;
    db = database;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Initialise this module, injecting the necessary dependencies as well as scheduling the weekly update
 * @param {Object} destiny The bungie_access.mjs dependency, that it exports as an object
 * @param {Object} database The user_database.mjs dependency, that it exports as an object
 *
 */
function initialise(destiny,database){
    console.log("User Services:// Initialising Service");
    injectDependencies(destiny,database);
    console.log("User Services:// Scheduling weekly update");
    cron.schedule(
        "5 18 * * 2",//time expression, maps to 18:05 BST on a Tuesday
        weeklyUpdate//function to execute
    )
    console.log("User Services:// Initialisation complete");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Export all necessary functions so the necessary external modules can utilize it as a dependency
 * @type {Object}
 */
export default {
    getUserItems,
    getWeaponStats,
    getCharacterConfiguration,
    getRecentActivities,
    getKnowledgeBase,
    getCoachData,
    getVaultItems,
    getActivity,
    getActivitySummary,
    getAllPlayerActivityReports,
    initialise
}
