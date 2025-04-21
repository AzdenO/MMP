
var driver = null;
var destiny = null;
var console_reader = null;
var connectionPool = null;
var queries = [];

import {AuthError,InitError,UserNotFoundError,InvalidTokenError} from "./utils/errors.mjs";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 * Import JSDoc type definitions
 *
 */
/**
 * @typedef {import("./types/databaseObjects.mjs").TokenData} TokenData
 */

import fs from "node:fs";
//import secretiser from "./utils/cryptography.mjs";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function newUser(user_details,progressionData, items){
    console.log("Database:// Adding new user to database");
    const connection = await getConnection();
    await connection.execute("CALL newUser(?,?,?,?,?,?,?,?,?,?)",[
        user_details.displayname,
        user_details.accountID,
        user_details.membershipid,
        user_details.membertype.toString(),
        JSON.stringify(user_details.characters),
        user_details.refreshToken,
        user_details.refresh_expiry,
        user_details.accessToken,
        user_details.accessExpiry,
        JSON.stringify(user_details.progression,null,4),
    ]);
    await connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function refreshUser(userid){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function deleteUser(userid){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET USER BY REFRESH TOKEN
* Part of secure logging in, where the client sends a refresh token cookie for automatic logging in, and the database
* retrieves the users data by matching the provided token to the users table
*/
async function getUser(token, userObj) {
    console.log("Database:// Querying database for user details with provided token");
    const connection = await getConnection();
    const result = await connection.execute("CALL authUser(?)",[token]);
    await connection.release();
    if(result.length == 0){
        throw new UserNotFoundError();//no user with that token
    }else{
        console.log("Datbase:// Existing user found");
        userObj.details = result[0];
        console.log(userObj.details);

    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* CHECK IF A USER EXISTS IN THE DATABASE
* Public module method used by server authorisation when no refresh token cookie is present, specifically in the case
* of when the cookie has expired past its maximum age, indicating the users data may still exist, if it hasnt been longer than
* 90 days, when the database automatically deletes the users data
*/
async function checkForUser(userid){
    console.log("Database:// Checking for existing user by display name");
    const connection = await getConnection();
    const result = await connection.execute("CALL getUser(?)",[userid]);
    await connection.release();
    if(result[0][0].length==0){
        return false;
    }else if(result[0][0][0].userid==userid){
        console.log("Database:// Existing user found");
        return true;
    }else{
        console.log("Database:// No user found");
        return false;
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function storeItem(itemdata, type){
    console.log(`Database:// Storing item:\n\t ${itemdata[3]} of type ${itemdata[5]} for user ${itemdata[2]}`)
    const connection = await getConnection();
    var result = null;
    if(type == "Weapon"){
        result = await connection.execute("CALL addWeapon(?,?,?,?,?,?,?,?,?)",itemdata);
    }else if(type == "Armor"){
        await connection.execute("CALL addArmor(?,?,?,?,?,?,?,?)",itemdata);
    }

    connection.release();

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function queryItem(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* INJECT ALL MODULE PRIMARY DEPENDENCIES
* Private Module setter method used in module initialisation for mysql library and bungie access dependency injection
*/
function inject_dependencies(dependency,bungie,reader){
    driver = dependency;
    destiny = bungie;
    console_reader = reader;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* Private module method used in module initialisation to load pre-structured queries
*/
async function load_queries(){
    const querystream = await fs.readFileSync("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/db_queries.txt", "utf8");
    queries = querystream.split("/--/");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* Private module method to create a new database, as well as creating all tables
*/
async function init_db(){
    const connection = await getConnection();
    for(let x=0; x<3; x++){
        await connection.execute(queries[x]);
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* Private module method to create a connection instance to a running MySQL server instance running locally
*/
async function connect(){
    console.log("Database:// Establishing connection to MySQL server instance");

    const input = await console_reader({
        type: "password",
        name: "db_pass",
        message: "\tINPUT:// Enter MySQL server root password: ",
        mask: "*"
    })
    var con_options = {
        host: "localhost",
        user: "root",
        password: input.db_pass,
        port: 3001,
        database: "mentor_db",
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 300,
        idleTimeout: 30
    }
    try{

        connectionPool = driver.createPool(con_options);
        var testConnect = await connectionPool.getConnection();
        testConnect.release();
        console.log("Database:// Connection pool created, no errors");
    }catch(error){
        console.log("Database:// Error in creating DB connection\n\t"+error.code);
        throw new InitError(error.message,"DB_CON_ERR");

    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function initialise(dependency,destiny,sync_reading,NEW){
    inject_dependencies(dependency,destiny,sync_reading);
    await load_queries();
    await connect();
    if(NEW){
        console.log("Database:// Initialising new database")
        await init_db();
    }else{
        console.log("Database:// connecting to existing database");
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getConnection(){
    return await connectionPool.getConnection();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* UPDATE A USERS REFRESH TOKEN AND EXPIRY DATE
* This function is used by User Services when an authorisation request on the server receives an auth code, not any kind
* of identifier (refresh token) where we can check the database first. As part of that flow, the user service gets the player
* data from destiny first which involves asking for new tokens from bungie, invalidating what is stored in the database. Therefore
* the new refresh token needs adding to the database for requests where the refresh token is used.
*/
async function updateRefresh(token, expiry, user){
    const connection = await connectionPool.getConnection();
    connection.execute("CALL updateRefresh(?,?,?)",[token,expiry,user]);
    connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ITEMS BELONGING TO PLAYER WITH PROVIDED USERID
* Method for retrieving all of a players items from the database, a list of arguments can be passed to retrieve only
* specific item types, power levels, etc. (Currently only retrieves all player items, further implementation at later date)
*/
async function getUserItems(userid, args=null){
    console.log(`Database:// Item retrieval request for user: ${userid}`);
    const connection = await getConnection();

    const result = await connection.execute("CALL getAllPlayerItems(?)",[userid]);
    return [result[0][0],result[0][1]];
    connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to update the access token stored in the database for the provided user, calling a stored procedure on the database
 * @param {string} userid bungie display name for a user which equates to a unique primary or foreign key
 * @param {TokenData} args an object of type {userid:"", token:"", expiry:""}
 * @param {boolean} type a boolean flag on whether to update the access token or refresh token for the user. True indicates updating
 * the access token, and false obviously is for refresh token
 * @returns {Promise<boolean>} a boolean indicating the success of the database operation
 */
async function updateTokens(args, type){
    const connection = await getConnection();
    console.log("Database:// Updating access token for: "+args.userid);
    try{
        var result;
        if(type){
            result = await connection.execute("CALL updateAccess(?,?,?)", [args.token,args.expiry,args.userid]);
        }else{
            result = await connection.execute("CALL updateRefresh(?,?,?)",[args.token,args.expiry,args.userid]);
        }

    }catch(error){

    }
    connection.release();

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getUserIDByRefresh(refresh){
    const connection = await getConnection();
    const result = connection.execute("CALL getUserIDByRefresh(?)", [refresh]);
    if(!result[0][0][0]){
        connection.release();
        throw new InvalidTokenError();
    }else{
        connection.release();
        return result[0][0][0];
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to query the database with a provided token to query its validity, returning a userid if successful
 * @param {string} token The refresh or access token to query the database for
 * @param {boolean} flag true indicates we are querying for an access token. This could be changed in future versions
 * to a string equivalency check to be more verbose.
 * @returns {Promise<string>} The userid associated with the provided token, will return "none" if no user was found
 */
async function queryToken(token, flag){
    const connection = await getConnection();
    console.log("Database:// Querying database for token");

    try{
        const result = await connection.execute("CALL queryToken(?,?)",[token, flag]);
        if(!result[0][0][0]){
            throw new InvalidTokenError();
        }else{
            connection.release();
            return result[0][0][0].userid;
        }
    }catch(error){
        console.log(error);
    }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch from the database all details necessary to make requests to bungie protected endpoints, including
 * the member id, platform type, and access token
 * @param {string} userid The bungie display name to fetch the details for
 * @returns {Promise<Object>} An object containing all data as key-values
 */
async function getBungieRequestData(userid){
    const connection = await getConnection();

    const result = await connection.execute("CALL getAccountData(?)",[userid]);
    return {
        platformid: result[0][0][0].platformid,
        platformtype: result[0][0][0].platformtype,
        token: result[0][1][0].access_token,
    };
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getProgressionData(userid){
    const connection = await getConnection();
    const result = await connection.execute("CALL getProgressions(?)",[userid]);
    return result[0][0][0];
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch a list of userids for every user on the server
 * @returns {Promise<Array<string>>} An array of userids
 */
async function getAllUsers(){
    const connection = await getConnection();

    const result = await connection.execute("SELECT userid FROM users");
    const array = result[0].map(user => user.userid);//return only an array of userids, not objects
    connection.release();
    return array;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to update the weekly stats for a specific user
 * @param {string} userid The user to update stats for
 * @param {JSON} progression The progression data store in the thisWeekStats column
 * @returns {Promise<void>}
 */
async function updateProgressionData(userid, progression){
    const connection = await getConnection();

    const result = await connection.execute("CALL updateProgressions(?,?)",[userid,JSON.stringify(progression,null,4)]);
    connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Exported object containing all methods required for general server services, and excludes any methods typically used
 * for authentication
 * @type {{initialise: ((function(*, *, *, *): Promise<void>)|*), getUser: ((function(*, *): Promise<void>)|*), newUser: ((function(*, *): Promise<void>)|*), refreshUser: refreshUser, storeItem: ((function(*, *): Promise<void>)|*), checkForUser: ((function(*): Promise<boolean>)|*), updateRefresh: ((function(*, *, *): Promise<void>)|*), getUserItems: ((function(*, null=): Promise<[*,*]|undefined>)|*)}}
 */
export const dbBaseServices = {
    initialise,
    getUser,
    newUser,
    refreshUser,
    storeItem,
    checkForUser,
    updateRefresh,
    getUserItems,
    updateProgressionData,
    getAllUsers,
    getProgressionData,
    getBungieRequestData
}
/**
 * Exported object containing methods only used for authentication purposes, to cleanly seperate base db logic from auth logic
 * for modules that require different db services
 * @type {{updateTokens: ((function(*, *): Promise<boolean>)|*), queryToken: ((function(string, boolean): Promise<string>)|*)}}
 */
export const dbAuthServices = {
    updateTokens,
    queryToken,
    getUser,
    checkForUser,
    newUser,
    getUserIDByRefresh,
}