
var driver = null;
var destiny = null;
var console_reader = null;
var connectionPool = null;
var queries = [];

import {AuthError,InitError,UserNotFoundError} from "./utils/errors.mjs";

import fs from "node:fs";
//import secretiser from "./utils/cryptography.mjs";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function newUser(user_details, items){
    console.log("Database:// Adding new user to database");
    const connection = await getConnection();
    await connection.execute("CALL newUser(?,?,?,?,?,?,?)",[
        user_details.displayname,
        user_details.accountID,
        user_details.membershipid,
        user_details.membertype.toString(),
        JSON.stringify(user_details.characters),
        user_details.refreshToken,
        user_details.refresh_expiry])
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
async function storeUserItems(items, userid){

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
    for(let x=1; x<3; x++){
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
* data from destiny which involves asking for new tokens from bungie, invalidating what is stored in the database. Therefore
* the new refresh token needs adding to the database for requests where the refresh token is used.
*/
async function updateRefresh(token, expiry, user){
    const connection = await connectionPool.getConnection();
    connection.execute("CALL updateRefresh(?,?,?)",[token,expiry,user]);
    connection.release();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const db = {
    initialise,
    getUser,
    newUser,
    refreshUser,
    storeUserItems,
    checkForUser,
    updateRefresh
}