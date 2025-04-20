//////////////////////////////////////////REQUIRED MODULES////////////////////////////////////////////////
import env from "dotenv";//safely storing of secrets
import dayjs from "dayjs";
import fs from "node:fs";//for writing to files, not technically necessary apart from when saving responses from bungie to look at more easily
import {AuthError,InitError} from "./utils/errors.mjs";
import {parseWeaponStats,parseActivityHistory,setGameData,parseItems,parseTokenResponse} from "./utils/bungieParser.mjs";
import * as Endpoints from "./constants/BungieEndpoints.mjs";
import * as EndpointParameters from "./constants/BungieEndpointConstants.mjs";
import {replaceMultiple} from "./utils/stringUtils.js";
import {delay} from "./utils/timeUtils.mjs";
env.config();
/////////////////////////////////////////LOAD API ENVIRONMENT VARIABLES///////////////////////////////////
const apikey = process.env.D2_API_KEY;
const clientid = process.env.D2_CLIENT_ID;//doesnt need to be a secret but is of the theme so might as well store it here
const clientsecret = process.env.D2_CLIENT_SECRET;
/////////////////////////////////////////REQUEST VARIABLES////////////////////////////////////////////////
/**
 * The current request number used to avoid bungie api throttling. This is managed inside of protected request and resets
 * every second
 * @type {number}
 */
var curReqNum = 0;

/**
 * The number of milliseconds since bungie api throttle management was reset. Once this reaches a thousand, it starts again
 * and curReqNum is reset to 0
 * @type {number}
 */
var reqMillis = 0;
/////////////////////////////////////////////////////BUNGIE RETURN VALUES/////////////////////////////////

const classTypes = ["Titan","Hunter","Warlock"];//bungie only returns a number for the character class type. We use this number as the index of the array to return the actual class type
var bucketHashes = [];//bungie provides a bucket hash for each item which essentially defines the type of item, generated dynamically
const damageTypes=["Not Applicable","Kinetic","Arc","Solar","Void","Raid Damage","Stasis","Strand"];//every weapon has a numeric value for its damage type
var perkHashes = [];//bungie provides a hash for each perk on a weapon, which we query the manifest for to get its name
var statHashes = [];//bungie provides a hash value for every stat on a weapon or armor piece, we query the manifest for this static data
var plugHashes = [];
var activityTypeHashes = [];
var staticActivities = [];
var activityModifiers = [];
var activeActivities = [];
var itemNameHashes = [];//stores all items in the game, including their hash, name and description
var manifestData = null;//as part of module init, multiple calls would need to be made to the manifest endpoint. Caching the first request made to it saves time for subsequent requests for other module iniitialisation attributes

////////////////////////////////////////MISCELLANEOUS VARIABLES///////////////////////////////////////////
const logbreak = "////////////////////";

//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* QUERY BUNGIE API FOR DETAILS ON A NEW APPLICATION USER
* Function called by the coach that encompasses all necessary function calls, and returns all data in an object the coach
* object will store as an attribute
*/
async function getNewUser(auth_code){
    var userDetails = {};

    const data = await getUserAccess(auth_code, false);
    if(data=="error"){
        throw new AuthError("Error in acquiring bungie access with provided auth code","1001");
    }
    userDetails.accountID = data.memberID;
    userDetails.accessToken = data.access;
    userDetails.refreshToken = data.refresh;
    userDetails.refresh_expiry = dayjs().add(data.refresh_expiry, "seconds").format("DD-MM-YYYY HH:mm:ss");
    userDetails.accessExpiry = dayjs().add(data.access_expiry, "seconds").format("DD-MM-YYYY HH:mm:ss");
    const accountdata = await getAccountSpecificData(userDetails.accessToken);
    if(accountdata=="error"){
        throw new AuthError("Error in acquiring user specific details","1002");
    }
    userDetails.membershipid = accountdata.Response.destinyMemberships[0].membershipId;
    userDetails.membertype = accountdata.Response.destinyMemberships[0].membershipType;
    userDetails.displayname = accountdata.Response.destinyMemberships[0].bungieGlobalDisplayName+accountdata.Response.destinyMemberships[0].bungieGlobalDisplayNameCode.toString();

    userDetails.characters = await getAccountCharacters(userDetails.accessToken,userDetails.membershipid,userDetails.membertype);

    return userDetails;

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to make a post request to bungies OAuth2 token endpoint to excahnge either a refresh token or auth code for a new
 * set of tokens
 * @param {string} code The code to exchange
 * @param {boolean} flag True if exchanging a refresh token, false otherwise
 * @returns {Promise<any|string>}
 */
async function getUserAccess(code, flag) {
    var grant = "authorization_code";
    if(flag) {//if this is a new user, therefore a refresh token does not exist
        grant = "refresh_token";
    }
        const request_body = new URLSearchParams({//convert authorization attributes into URL encoded format
            grant_type: 'authorization_code',
            code: code,
            client_id: clientid,
            client_secret: clientsecret
        }).toString();

        try{
            const res = await fetch(Endpoints.user_access_token, {
                method: 'POST',
                headers:{
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: request_body
            });
            if(!res.ok){
                const consumed = await res.json();//convert response into JSON object
                console.log(consumed.message);//log message bungie returns for more detail on what went wrong
                return "error";
            }
            else{
                const consumed = await res.json();
                //console.log(consumed);
                return parseTokenResponse(consumed);
            }
        }catch(error){
            console.log("Found an error in user authentication: "+error);
        }



}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ACCOUNT MEMBERSHIPS
* Public module method for getting the users primary membershipid, which equates to the platform they play on, accompanied
* by a membership type. These are required attributes in alot of API calls such as getting characters, inventories and items, etc.
*/
async function getAccountSpecificData(access_token){

    console.log("Bungie:// Retrieving user account data");

    const response = await protectedRequest(access_token,Endpoints.user_account_data,"Account Data Request");
    return response;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ACCOUNT CHARACTERS
* Function that requests users characters, and parses the response to be held in the coach object at the end of function call
*/
async function getAccountCharacters(access_token,membershipid,membertype){
    var hoursPlayed = 0;

    console.log("Bungie:// Retrieving user characters");

    const pathParams = {
        "TYPE": membertype,
        "MEMBERID": membershipid
    }
    //replace url dyanmic components with user data
    const final_url = replaceMultiple(/TYPE|MEMBERID/g,pathParams,Endpoints.user_data_url)+"?components=200";

    console.log("\tMaking request to: "+final_url);

    const response = await protectedRequest(access_token,final_url,"Account Characters Request");
    var characterlist = {characters:[]};
    Object.entries(response.Response.characters.data).forEach(([element, data]) => {//iterate through character objects dynamically
        characterlist.characters.push([data.characterId,data.light,classTypes[Number(data.classType)]]);
        hoursPlayed+= data.minutesPlayedTotal/60;
    });
    hoursPlayed.toPrecision(2);//round to 2 decimal places, to be memory efficient
    return characterlist;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET CHARACTER INVENTORY AND ITEM DETAILS
* PRIVATE module method to retrieve equipped and unequipped items on a character.
* This method does not format what is returned, and simply returns the response it gets from the bungie api for use in a method
* that will parse the response.
*/
async function getPlayerInventoryItems(access_token,characterid, memberid,membertype){

    console.log("Bungie:// Retrieving character inventory for character: "+characterid);//log action

    const pathParams = {
        "TYPE": membertype,
        "MEMBERID": memberid,
        "CHARACTERID": characterid,
    }
    //construct URL with user specific data
    const final_url = replaceMultiple(/TYPE|MEMBERID|CHARACTERID/g,pathParams,Endpoints.user_inventory_url);
    console.log("\tMaking request to: "+final_url);

    //make request
    const response = await protectedRequest(access_token,final_url,"Player Inventory Request");
    return response.Response;//only this element is necessary, including the other component values in the url, allows the bungie api to construct a 300 response for all items listed
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch items for a players character
 * @param characterid the id for the character we are fetching for
 * @param membershipid player membership id, tied to platform they play on
 * @param membertype platform type the player plays on
 * @param access_token access token used by this registered application to access player data on their behalf
 * @param equipped boolean to indicate whether to fetch what is equipped or unequipped
 * @returns {Promise<void>} A bungie api response, this will need parsing by the bungie parser module
 */
async function getCharacterItems(characterid,membershipid,membertype,access_token, equipped){

    const pathParams = {
        "TYPE": membertype,
        "MEMBERID": membershipid,
        "CHARACTERID": characterid,
    }
    let key = "equipment"
    let locationComponent = 0;

    if(equipped){
        locationComponent = 205;
    }
    else{
        locationComponent = 201;
        key = "inventory";
    }
    console.log("Bungie:// Retrieving equipped character items for character: "+characterid);
    const final_url = replaceMultiple(/TYPE|MEMBERID|CHARACTERID/g,pathParams,Endpoints.user_inventory_url)+"?components=300,304,302,305,"+locationComponent;

    const res = await protectedRequest(access_token,final_url,"Character Equipped Items Request");
    await fs.writeFile("O://exampleEquippedItems.json",JSON.stringify(res,null,4),err => {});
    return parseItems(res,key);
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 *
 * @param membershipid is the players bungie membership ID tied to the platform they play on
 * @param membertype an enum indicator for platform type the player plays on
 * @param access_token is the token required to access private player data, generated by bungie through OAuth2 flow
 * @returns {Promise<void>}
 */
async function getVaultItems(membershipid,membertype,access_token){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ALL PLAYER ITEMS ACROSS ALL CHARACTERS INCLUDING THE PLAYERS VAULT
* All-encompassing method to fetch and parse all player items from all applicable sources, including what is
* equipped and unequipped on each individual character as well as the players vault, returning a single list
* of all items,seperated by armor and weapons
*/
async function getAllPlayerItems(characterid,membershipid,membertype,access_token){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * GET PLAYER ACCOUNT WEAPON STATISTICS
 * Method to retrieve a players weapon statistics, specifically to get statistics for each individual weapon type
 * @param membershipid Player membership id, maps to platform player plays on
 * @param membertype Maps to platform type player plays on (enum)
 * @param access_token Unique token for accessing a specific players data
 * @param pve boolean flag whether to return pve results or pvp results
 * @returns {Promise<void>} A list of objects with {typeName: string, precision kills: int, total kills: int}
 */
async function getAccountWeaponStats(membershipid,membertype,access_token, pve){

    const flags = {
        "MEMBERTYPE": membertype,
        "MEMBERID": membershipid
    };

    const final_url = replaceMultiple(/MEMBERTYPE|MEMBERID/g,flags,Endpoints.weapon_stats_url);
    var requested = null;
    var result = await protectedRequest(access_token,final_url,"Account weapon stats Request");
    result = result.Response.mergedAllCharacters.results;
    if(pve){
        requested = result.allPvE.allTime;
    }else{
        requested = result.allPvP.allTime;
    }
    const results = parseWeaponStats(requested);
    fs.writeFile("O://exampleWeaponStatsParsed.txt",JSON.stringify(results,null,4),"utf8",(err) => {})
    return results;


}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to return all player activity reports for all time for the provided character id, using the Destiny2.getActivityHistory
 * end point to find all played instance IDs, iterating through these to fetch a PGCR for each one, and passing those to the parser
 * to return a minimal array of objects with key activity and player details
 * @param {string} membershipid Membership id associated with player account, mapping to platform player plays on
 * @param {string} membertype Enum indicator for platform type player plays on
 * @param {string} characterid The character whos reports we are returning
 * @param {string} access_token Provided by bungie api to access protected player data
 * @param {int} mode The activity mode to return reports for {DestinyActivityModeType: Enum} such as pvp, pve, raids, etc
 * @param {int} count The number of activities to return, if null, all player activities are returned
 * @returns {Promise<Array>} An array of parsed PGCRs
 */
async function getAccountActivityReports(membershipid,membertype,characterid,access_token,mode,count=null){
    console.log("Bungie:// Retrieving activity reports");
    var page = 0;
    var pages = [];
    if(count==null){
        count = 250;//max number per page
    }

    while(true){

        const fetched = await getActivityResultPage(page,membershipid,membertype,characterid,access_token,mode,count);
        pages.push(fetched);
        if(fetched.Response.activities.length<250){//applicable for the last page and if we are returning less than 250 activities
           break;
        }
        page++;
    }
    var pGCRs = [];
    var requests = [];
    for(const page of pages){

        for(const activity in page.Response.activities){
            await delay(50);
            requests.push(getActivityPGCR(page.Response.activities[activity].activityDetails.instanceId)
                .then(data =>{
                    pGCRs.push(data);
                })
            );
        }

    }
    const result = await Promise.all(requests).then(results => {//once all PGCR requests are resolved
        pGCRs = pGCRs.sort((left, right) => left.Response.period.localeCompare(right.Response.period));//sort array in descending order, as some PGCR requests will finish before the previous possibly
        const res = parseActivityHistory(pGCRs,characterid);//parse the array of PGCRs, returning the meaningful data
        return res;
    });
    return result;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to fetch a page of activity results from the Destiny2.getActivityHistory endpoint
 *
 * @param {int} page The page number to request
 * @param {string} membershipid Membership id associated with player account, mapping to platform player plays on
 * @param {string} membertype Enum indicator for platform type player plays on
 * @param {string} access_token Provided by bungie api to access protected player data
 * @param {int} mode The activity mode to return reports for {DestinyActivityModeType: Enum} such as pvp, pve, raids, etc
 * @param {int} count The number of activities to return for this page
 *
 * @returns {Promise<Object>} A bungie response parsed to an object
 */
async function getActivityResultPage(page,membershipid,membertype,characterid,access_token,mode, count){
    const pathParams = {
        "MEMBERTYPE": membertype,
        "MEMBERID": membershipid,
        "CHARID": characterid
    }

    const final_url = (replaceMultiple(/MEMBERTYPE|MEMBERID|CHARID/g,pathParams,activity_reports_url))+"?count="+count+"&page="+page+"&mode="+mode;
    console.log("Page url"+final_url);
    return await protectedRequest(access_token,final_url,"Account activity reports request");
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ITEM INSTANCE SPECIFIC DATA
* Private module method to retrieve specific details of a weapon and return a key-value store of the weapons
* attributes such as name, power level, mods and stats
*/
async function getItemData(access_token,memberid,membertype,instanceid){

    const url_construct = item_data_url;
    const phase1_url_construct = url_construct.replace("TYPE",membertype);
    const phase2_url_construct = phase1_url_construct.replace("MEMBERID",memberid);
    const final_url = phase2_url_construct.replace("ITEMID",instanceid);

    const response = await protectedRequest(access_token,final_url,"ItemData Request");

    if(response=="error"){

        return "error";

    }else{

        return response;
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to fetch a post game carange report of a particular played activity
 * @param instanceid The instance ID of the activity to fetch the full report for
 * @returns {Promise<void>} a json parsed response from bungie api
 */
async function getActivityPGCR(instanceid){
    const pathParams = {
        "INSTANCE": instanceid
    }
    const final_url = replaceMultiple(/INSTANCE/g,pathParams,pgcr_url);
    const response = await protectedRequest(null,final_url,"PGCR request",false);
    return response;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* MAKE REQUEST
* Private module method to simplify requests that use similar headers, which nearly all endpoints this server concerns do.
* Has a flow for access token requiring requests, as well as for requests of static destiny data, such as calls to the manifest.
* Handles errors efficiently by returning "error" or the expected response. All methods calling this should check the response
* before any computations are applied.
*/
async function protectedRequest(access_token,url,logtext,protect=true){

    var header = null;

    if(protect){
        header = {
            Authorization: `Bearer `+access_token,
            "X-API-Key": apikey
        }
    }else{
        header = {
            "X-API-Key": apikey
        };
    }
    ///////////////Throttle management, this should work for when different functions are making requests at similar times
    const currentMillis  =dayjs().valueOf();

    if(currentMillis-reqMillis<1500 && curReqNum==18){
        await delay(currentMillis-reqMillis);
        curReqNum=0;
        reqMillis=dayjs().valueOf();
    }else if(currentMillis-reqMillis>=1500){
        curReqNum=0;
        reqMillis=dayjs().valueOf();
    }
    curReqNum++;

    try{
        const res = await fetch(url, {
            signal: AbortSignal.timeout(15000),
            method: 'GET',
            headers: header
        });
        if(!res.ok){
            console.log(logtext+" Bad:\n"+logbreak+"\n"+res.toString());
            var consumed = await res.json();
            console.log(JSON.stringify(consumed,null,4));
            return "error";
        }
        else{
            var consumed = await res.json();
            //console.log(JSON.stringify(consumed,null,2));
            return consumed;
        }
    }catch(error){
        console.log("Found an error in "+logtext+" retrieval: "+error.stack);
        return "error";
    }
}
/////////////////////////////////////////////////////INITIALISATION METHODS/////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ALL RELEVANT BUCKET HASHES
* Private module method to retrieve all bungie becket hashes, which correlate to item types. Doing this dynamically instead
* of defining these as constants means the server remains more future proof in the case of any updates to the bungie API
* which change these values. Method is called when imported, storing results in a global, meaning this method is only called once
*/
async function getAllBucketHashes(){

    var relevant_buckets = ["Helmet","Chest Armor","Gauntlets","Leg Armor","Subclass","Modifications","Energy Weapons","Class Armor","Kinetic Weapons","Consumables","Power Weapons","General"];

    const response = await protectedRequest(null,Endpoints.manifest_url,"Requesting Manifest data",false);
    manifestData = response;//bucket hashes is the first init method called, so cache the result so subsequent init methods can use it
    if(response=="error"){

        console.log("Error in retrieving maifest data");
        return "error";

    }else{

        var def_url = Endpoints.baseDomain+response.Response.jsonWorldComponentContentPaths.en.DestinyInventoryBucketDefinition;
        const definitions = await protectedRequest(null,def_url,"Request bucket definitions",false);

        if(definitions=="error"){

            console.log("Error in retrieving bucket definitions");
            return "error";

        }else{

            Object.entries(definitions).forEach(([hash,data])=>{//for every bucket hash returned

                if(data.hasOwnProperty("displayProperties")){//if the hash is user-facing and therefore one of the ones we look for

                    if(!(typeof data.displayProperties.name==="undefined")){//name element may not exist for some display properties we check, so omit these to avoid errors later

                        for(var bucket in relevant_buckets){



                            bucketHashes.push({hashid: hash, name: data.displayProperties.name});


                        }
                    }
                }
            });
            return "success";
        }
    }

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ALL SUB CLASS HASHES
* Private module method to dyanmically retrieve all sub-class hashes from the bungie api, for use in parsing specific user
* data. NON-FUNCTIONING
*/
async function getSubClassHashes(){

    console.log("Found inventory item definition url: "+JSON.stringify(manifestData.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition,null,4));

    var relevant_hashes = [];

    const definitions = await protectedRequest(null,base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition,"Inventory Item Definition Request",false);
    fs.writeFile("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/example_Json/inventory_item_definitions_example.txt",JSON.stringify(definitions,null,4), err => {});

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ALL PERK HASHES
* Private module method to dynamically retrieve all perk hashes from the bungie api, for use in parsing specific user data
*/
async function getPerkHashes(){

    const perkResponse = await protectedRequest(null,Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinySandboxPerkDefinition,"Perk Hash Request",false);
    if(perkResponse=="error"){
        return "error";
    }

    for(const[key, properties] of Object.entries(perkResponse)){//for every perk
        if(properties.isDisplayable==true){
            perkHashes.push({hashid: key, name: properties.displayProperties.name, description: properties.displayProperties.description});
        }
    }

    return "success";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
* GET ALL ITEM STAT HASHES
* Private module method to dynamically retrieve all item stat hashes from the bungie api, called upon module initialisation
*/
async function getStatHashes(){
    const statResponse = await protectedRequest(null, Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyStatDefinition, "Stats Hash Request",false);
    if(statResponse=="error"){
        return "error";
    }

    for(const[key, properties] of Object.entries(statResponse)) {//for every stat

        statHashes.push({
            hashid: key,
            name: properties.displayProperties.name,
            description: properties.displayProperties.description
        });
    }
    return "success";

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getActivityModifierHashes(){
    const modifierHashes = await protectedRequest(null,Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityModifierDefinition,"Activity Modifiers",false);

    for(const[keyValue, modifier] of Object.entries(modifierHashes)){
        activityModifiers.push({
           hash: keyValue,
           name: modifier.displayProperties.name,
           description: modifier.displayProperties.description,
        });
    }

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getActivityTypeHashes(){
    const typeHashes = await protectedRequest(null,Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityTypeDefinition,"Activity Type",false);
    for(const[type_hash, value] of Object.entries(typeHashes)){
        activityTypeHashes.push({
           hash: type_hash,
           name: value.displayProperties.name
        });
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getActivityDefinitions(){
    const activityResponse = await protectedRequest(null,Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityDefinition,"Activity Definitions",false);

    for(const[activity_hash, hash] of Object.entries(activityResponse)){
        if(hash.displayProperties.name=="Classified"){
            continue;
        }
        var modifiers = [];
        if(hash.modifiers.length>0){
            for(const modifier of hash.modifiers){
                const foundModifier = activityModifiers.find(mod => mod.hash == modifier.activityModifierHash);
                if(typeof foundModifier==="undefined"){
                    continue;
                }
                modifiers.push({
                    name:  foundModifier.name,
                    description: foundModifier.description
                });
            }
        }
        staticActivities.push({
            hash: activity_hash,
            light_level: hash.activityLightLevel,
            name: hash.displayProperties.name,
            type: (activityTypeHashes.find(type => type.hash == hash.activityTypeHash)).name,
            description: hash.displayProperties.description,
            isPlaylist: hash.isPlaylist,
            modifiers: modifiers,

        });
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ALL ITEMS IN THE GAME, INCLUDING THEIR NAME, HASH ID AND DESCRIPTION
*/
async function getItemDefinitions(){
    const itemsResponse = await protectedRequest(null, Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition, "Item Hash Request",false);
    if(itemsResponse=="error"){
        return "error";
    }

    for(const[key, properties] of Object.entries(itemsResponse)) {//for every stat

        itemNameHashes.push({
            hashid: key,
            name: properties.displayProperties.name,
            description: properties.displayProperties.description,
            damage: damageTypes[properties.defaultDamageType]
        });
    }
    return "success";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getMilestoneActivities(){
    const milestones = await protectedRequest(null,Endpoints.baseDomain+"Platform/Destiny2/Milestones/","Milestones Request",false);

    for(const[keyval, milestone] of Object.entries(milestones.Response)){
        for(const activity in milestone.activities){
            const foundActivity = staticActivities.find(act => act.hash == milestone.activities[activity].activityHash);
            var modifiers = [];
            for(const modifier in milestone.activities[activity].modifierHashes){
                const foundModifier = activityModifiers.find(mod => mod.hash == milestone.activities[activity].modifierHashes[modifier]);
                modifiers.push({
                   name:  foundModifier.name,
                   description: foundModifier.description
                });
            }
            activeActivities.push({
                hash: foundActivity.hash,
                name: foundActivity.name,
                description: foundActivity.description,
                modifiers: modifiers
            });
        }
    }
    //console.log(JSON.stringify(activeActivities,null,4));

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getActivityModeDefinitions(){
    const res = await protectedRequest(null,Endpoints.baseDomain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityModeDefinition,"Activity Modes Request",false);
    fs.writeFile("O://activitymodeexample.txt",JSON.stringify(res,null,4),function(err){})
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function set_dependencies(db){
    user_db = db;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function seperateItems(items){

    var armors = [];
    var weapons = [];

    const armorTypes = ["Helmet","Chest Armor","Gauntlets","Leg Armor","Class Armor"];
    const weaponTypes = ["Energy Weapons","Kinetic Weapons","Power Weapons"];

    for(var item in items){
        if(checkType(items[item].item_type,armorTypes)){
            armors.push(items[item]);
        }else if(checkType(items[item].item_type, weaponTypes)){
            weapons.push(items[item]);
        }
    }
    return [armors, weapons];

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function checkType(item_type, types){
    for(var type in types){
        if(item_type == types[type]){
            return true;
        }
    }
    return false;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function that manages throttling, to ensure requests do not go over the 25req/s limit of the bungie api.
 *
 * @returns either a number representing the number of milliseconds till a request can be made, or a boolean
 * to say a request can be made
 */
function throttleManager(){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* INITIALISE MODULE
* Private module method that encompasses all method calls relevant for initialising the module for use,
* such as initialising the bucket hashes list, which some module methods will use
*/
async function moduleInit(){

    console.log("\nBungie Module Initialisation...");

    console.log("Bungie:// Acquiring relevant bucket hashes...\n");
    if(await getAllBucketHashes()==="success"){console.log("Acquired bucket hashes")}else{console.log("Error in acquiring buckets")}//instantiate bucket hashes array, providing the hash value and the relevant name in a key value store

    console.log("Bungie:// Acquiring subclass hashes...\n");

    //await getSubClassHashes();//non-functioning atm, I have to parse a 272mb file, and I dont wanna do that, if the devil exists, hes a json response

    console.log("Bungie:// Acquiring perk hashes...");
    if(await getPerkHashes()==="success"){console.log("\tAcquired perk hashes")}else{console.log("Error in acquiring perks")};

    console.log("Bungie:// Acquiring stat hashes...");
    if(await getStatHashes()==="success"){console.log("\tAcquired stat hashes")}else{console.log("Error in acquiring stats")};

    console.log("Bungie:// Acquiring all game items...");
    if(await getItemDefinitions()==="success"){console.log("\tAcquired all game items")}else{console.log("Error in acquiring game items")};

    console.log("Bungie:// Acquiring activity types...");
    await getActivityTypeHashes();

    console.log("Bungie:// Acquiring activity definitions...");
    await getActivityDefinitions();

    console.log("Bungie:// Acquiring activity modifier definitions...");
    await getActivityModifierHashes();

    console.log("Bungie:// Acquiring active activities...");
    await getMilestoneActivities();

    await  getActivityModeDefinitions();

    //pass bungie parser all static game data to be used in parsing all future responses from user requests
    setGameData(staticActivities,activityModifiers,activeActivities,itemNameHashes,perkHashes,statHashes,bucketHashes);

    reqMillis = dayjs().valueOf();//set req millis


}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

await moduleInit();//initialise module

export const destiny_full = {
    set_dependencies,
    getNewUser,
    getAccountWeaponStats,
    getAccountActivityReports,
    getCharacterItems
}
export const bungieAuth = {
    getNewUser,
    getUserAccess
}

export default {getUserAccess,getAccountCharacters,getAccountSpecificData,getPlayerInventoryItems};