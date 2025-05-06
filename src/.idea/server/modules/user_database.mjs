/**
 * @module UserDatabase
 * @description A module to encapsulate all interaction with the MySQL server instance, and therefore the database. This
 * module utilizes the MySQL2 package as a driver for this communication
 * @version 0.2.3
 * @author Declan Roy Alan Wadsworth (drw8)
 */


/**
 * Global variable to hold MySQL2 dependency
 * @type {Object}
 */
var driver = null;
/**
 * Global variable to hold synchronous console reader dependency provided by the prompts library
 * @type {function}
 */
var console_reader = null;
/**
 * Global variable to hold the connection pool created upon module initialisation
 * @type {Object}
 */
var connectionPool = null;
/**
 * Global array to hold a list of prompts loaded from a file
 * @type {Array<string>}
 */
var queries = [];

/*
 * Import defined errors
 */
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
/**
 * Insert a new application user into the database. This takes details and stores them in the corresponding tables
 * @param {Object} user_details An object containing the core details of a user in the form
 * {
 *  displayname: string, accountID: string, membershipid: string, membertype: int, refreshToken: string, refresh_expiry: string,
 *  accessToken: string, accessExpiry: string, progression: Object, characters: Object
 * }
 * @returns {Promise<void>}
 */
async function newUser(user_details){
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
/**
 * Check if a user already exists in the database. Utilized mostly for authentication by OAuth2 code with the server which
 * is generally meant for new users, but edge cases exist where an existing user may authenticate via such.
 * @param {string} userid The unique bungie global display name which is a primary key in all tables
 * @returns {Promise<boolean>}
 */
async function checkForUser(userid){
    console.log("Database:// Checking for existing user by display name");
    const connection = await getConnection();
    const result = await connection.execute("CALL getUser(?)",[userid]);
    await connection.release();
    if(result[0][0].length==0){
        return false;//the user does not exist
    }else if(result[0][0][0].userid==userid){
        console.log("Database:// Existing user found");
        return true;//the user does exist
    }else{
        console.log("Database:// No user found");
        return false;//edge case
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
/**
 * Inject all module dependencies
 * @param {Object} dependency The main MySQL2 dependency required for communication and interaction with the database on
 * the MySQL server instance
 * @param {Object} reader The prompts dependency that allows for synchronous reading from the console
 */
function inject_dependencies(dependency,reader){
    driver = dependency;
    console_reader = reader;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to load queries from a text file which can configure a new instance of the MentorDB on a MySQL server instance
 * @returns {Promise<void>}
 */
async function load_queries(){
    const querystream = await fs.readFileSync("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/DatabaseResources/db_queries.txt", "utf8");
    queries = querystream.split("/--/");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to configure a new instance of the MentorDB
 * @returns {Promise<void>}
 */
async function init_db(){
    const connection = await getConnection();
    for(let x=0; x<3; x++){
        await connection.execute(queries[x]);
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 *
 * @returns {Promise<void>}
 */
async function connect(){
    console.log("Database:// Establishing connection to MySQL server instance");
    /*
     * Configure console input
     */
    const input = await console_reader({
        type: "password",
        name: "db_pass",//name of property in the constant that will contain the input
        message: "\tINPUT:// Enter MySQL server root password: ",//message to display to user
        mask: "*"//input mask, hides input
    })
    /*
     * Configuration options for the MySQL2 connection pool object
     */
    var con_options = {
        host: "localhost",//address where the MySQL server instance listens
        user: "root",//the user account of the MySQL server to access it with
        password: input.db_pass,//password for user
        port: 3001,//port the MySQL server listens on
        database: "mentor_db",//name of the database schema
        waitForConnections: true,
        connectionLimit: 20,//limit to the number of connection objects the pool will create
        queueLimit: 300,//the number of connection requests that can be made and waiting concurrently before rejecting anymore
        idleTimeout: 30//the time in seconds a connection has to resolve before it is cancelled
    }
    /*
     * Create connection pool and test configuration validity
     */
    try{

        connectionPool = driver.createPool(con_options);//create a new connection pool with declared configuration
        var testConnect = await connectionPool.getConnection();//test the connection, ensures configuration options are valid as well as if credentials are valid. Will throw an error if not, which is caught at the top level of the server to cancel server initialisation
        testConnect.release();
        console.log("Database:// Connection pool created, no errors");
    }catch(error){
        console.log("Database:// Error in creating DB connection\n\t"+error.code);
        throw new InitError(error.message,"DB_CON_ERR");

    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Initialise this module. Injecting necessary dependencies, connection to the MySQL server instance and creating tables if
 * this is a new database instance
 * @param {Object} dependency The MySQL2 dependency instantiated at index.mjs for top-level dependency management
 * @param {Object} sync_reading instance of Prompts which allows for synchronous console input reading, used for MySQL password input
 * @param {boolean} NEW Boolean indicator to determine whether the database has already been configured, or if tables need
 * to be created, and will therefore use the stored queries to do so
 * @returns {Promise<void>} Indicates if this function resolved sucessfully, not really used
 */
async function initialise(dependency,sync_reading,NEW){
    inject_dependencies(dependency, sync_reading);
    await load_queries();//load queries from text file
    await connect();//connect to database (a database must already exist regardless of if we are configuring a new one)
    if(NEW){//switch for new or not
        console.log("Database:// Initialising new database")
        await init_db();
    }else{
        console.log("Database:// connecting to existing database");
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to encapsulate interaction with global connection pool. Makes handling race conditions more centralized
 * @returns {Promise<Connection>} A connection object instance from MySQL2
 */
async function getConnection(){
    return await connectionPool.getConnection();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to update the refresh token stored for a user in the tokens table
 * @param {string} token The new token value
 * @param {string} expiry The expiration data of this token
 * @param {string} user The userid to update the token for
 * @returns {Promise<void>}
 * @deprecated This function is no longer in use, as a centralized function to update all token types was implemented
 */
async function updateRefresh(token, expiry, user){
    const connection = await connectionPool.getConnection();
    await connection.execute("CALL updateRefresh(?,?,?)",[token,expiry,user]);
    connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Retrieve user items from the database
 * @param {string} userid The user to retrieve items for
 * @returns {Promise<Array<Object>>} Array of objects, each corresponding to a weapon or armour piece
 * @deprecated Items are no longer stored in the database, but are left here in case of future use
 */
async function getUserItems(userid){
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
/**
 * Function used to retrieve a userid with a provided refresh token.
 * @param {string} refresh The refresh token to query the database with
 * @returns {Promise<string>} The userid found
 * @throws InvalidTokenError If the refresh token is invalid, i.e., this token does not exist and likely expired
 */
async function getUserIDByRefresh(refresh){
    const connection = await getConnection();//retrieve a connection object from the module connection pool
    const result = connection.execute("CALL getUserIDByRefresh(?)", [refresh]);//call stored procedure and provide list of params
    if(!result[0][0][0]){//if no userid is present
        connection.release();//release connection
        throw new InvalidTokenError();//throw error to be handled at top-level of endpoint processing
    }else{
        connection.release();
        return result[0][0][0];//return the userid found
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
/**
 * Method to retrieve progression tracking data stored in the Progressions table.
 * @param {string} userid The user to fetch progression for
 * @returns {Promise<Object>} progression data
 */
async function getProgressionData(userid){
    const connection = await getConnection();
    const result = await connection.execute("CALL getProgressions(?)",[userid]);
    return result[0][0][0];
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch a list of userids for every user this server tracks data for. This does not use a stored procedure,
 * but also does not pass any parameters, so is safe from SQL injection attack.
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