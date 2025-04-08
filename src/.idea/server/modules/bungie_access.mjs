//////////////////////////////////////////REQUIRED MODULES////////////////////////////////////////////////
import env from "dotenv";//safely storing of secrets
import dayjs from "dayjs";
import fs from "node:fs";//for writing to files, not technically necessary apart from when saving responses from bungie to look at more easily
var user_db = null;
import {AuthError,InitError} from "./utils/errors.mjs";
import {parseWeaponStats} from "./utils/bungieParser.mjs"
import {replaceMultiple} from "./utils/stringUtils.js";
env.config();
/////////////////////////////////////////LOAD API ENVIRONMENT VARIABLES///////////////////////////////////
const apikey = process.env.D2_API_KEY;
const clientid = process.env.D2_CLIENT_ID;//doesnt need to be a secret but is of the theme so might as well store it here
const clientsecret = process.env.D2_CLIENT_SECRET;
/////////////////////////////////////////COMMON ENDPOINTS/////////////////////////////////////////////////
const base_domain="https://www.bungie.net";
const user_access_token = "https://www.bungie.net/Platform/App/oauth/token/";//pass an auth code from OAuth2 to receive access and refresh tokens
const user_inventory_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/Character/CHARACTERID/?components=102,201,205,300";
const user_vault_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/Character/CHARACTERID/?components=102,300";
const user_account_data = "https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/";
const user_data_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/?components=COMPONENTS";//for getting characters, vault data, etc.
const item_data_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/Item/ITEMID/?components=300,302,304,305";
const manifest_url = "https://www.bungie.net/Platform/Destiny2/Manifest/";//url for static game data, such as bucket hashes
var weapon_stats_url = "https://www.bungie.net/Platform/Destiny2/MEMBERTYPE/Account/MEMBERID/Stats/?groups=Weapons";

var manifestData = null;//as part of module init, multiple calls would need to be made to the manifest endpoint. Caching the first request made to it saves time for subsequent requests for other module iniitialisation attributes
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

    const data = await getUserAccess(null, auth_code);
    if(data=="error"){
        throw new AuthError("Error in acquiring bungie access with provided auth code","1001");
    }
    userDetails.accountID = data.membership_id;
    userDetails.accessToken = data.access_token;
    userDetails.refreshToken = data.refresh_token;
    userDetails.refresh_expiry = dayjs().add(data.refresh_expires_in, "seconds").format("DD-MM-YYYY HH:mm:ss");

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
/*
* GET BUNGIE AUTHENTICATION
* Method for getting authorisation from the bungie api, to make requests for the user associated with the authorisation code
* or if the user is already in the server database, using their refresh token to exchange this for an active access token.
* If the refresh token is at its default, this is interpreted as a new server user
*/
async function getUserAccess(refreshToken=null,auth_code=null) {
    if(refreshToken==null){//if this is a new user, therefore a refresh token does not exist

        const request_body = new URLSearchParams({//convert authorization attributes into URL encoded format
            grant_type: 'authorization_code',
            code: auth_code,
            client_id: clientid,
            client_secret: clientsecret
        }).toString();

        try{
            const res = await fetch(user_access_token, {
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
                return consumed;
            }
        }catch(error){
            console.log("Found an error in user authentication: "+error);
        }



    }else{

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
    console.log("\tMaking request to: "+user_account_data);

    const response = await protectedRequest(access_token,user_account_data,"Account Data Request");
    return response;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ACCOUNT CHARACTERS
* Function that requests users characters, and parses the response to be held in the coach object at the end of function call
*/
async function getAccountCharacters(access_token,membershipid,membertype){

    console.log("Bungie:// Retrieving user characters");
    //replace url dyanmic components with user data
    const url_construct = user_data_url;
    const phase1_url_construct = url_construct.replace("TYPE",membertype);
    const phase2_url_construct = phase1_url_construct.replace("MEMBERID",membershipid);
    const final_url = phase2_url_construct.replace("COMPONENTS","200");
    console.log("\tMaking request to: "+final_url);

    const response = await protectedRequest(access_token,final_url,"Account Characters Request");
    var characterlist = {characters:[]};
    Object.entries(response.Response.characters.data).forEach(([element, data]) => {//iterate through character objects dynamically
        characterlist.characters.push([data.characterId,data.light,classTypes[Number(data.classType)]]);
    });

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

    //construct URL with user specific data
    const url_construct = user_inventory_url;
    const phase1_url_construct = url_construct.replace("TYPE",membertype);
    const phase2_url_construct = phase1_url_construct.replace("MEMBERID",memberid);
    const final_url = phase2_url_construct.replace("CHARACTERID",characterid);
    console.log("\tMaking request to: "+final_url);

    //make request
    const response = await protectedRequest(access_token,final_url,"Player Inventory Request");
    return response.Response;//only this element is necessary, including the other component values in the url, allows the bungie api to construct a 300 response for all items listed
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ALL CHARACTER ITEMS (EQUIPPED AND UNEQUIPPED) AS WELL AS USER VAULT ITEMS
* Method to retrieve inventory items and vault items in a format that can be easily read, especially by the reasoner
*/
async function getCharacterInventoryItemsAndVault(access_token,characterid,memberid,membertype){

    const equippedAndUnequipped = await getPlayerInventoryItems(access_token,characterid,memberid,membertype);
    var characteritems = []//variable to hold parsed data for items on the character
    var vaultitems = []//variable to hold parsed data for items in a players vault

    //check for errors
    if(equippedAndUnequipped == "error"){

        return "error";

    //beginning parsing response
    //then get item name from other endpoint
    }else{

        //Create lists to hold all parsed item types
        var items = []

        //first get isntance id, item hash id and bucket hash from inventory and equipment elements
        for(const item in equippedAndUnequipped.inventory.data.items){
            for(const buckethash in bucketHashes){
                if(bucketHashes[buckethash].hashid==equippedAndUnequipped.inventory.data.items[item].bucketHash){
                    items.push({item_type: bucketHashes[buckethash].name,instance: equippedAndUnequipped.inventory.data.items[item].itemInstanceId, itemId: equippedAndUnequipped.inventory.data.items[item].itemHash});
                }
            }
        }
        for(const item in equippedAndUnequipped.equipment.data.items){
            for(const buckethash in bucketHashes){
                if(bucketHashes[buckethash].hashid==equippedAndUnequipped.equipment.data.items[item].bucketHash){
                    items.push({item_type: bucketHashes[buckethash].name,instance: equippedAndUnequipped.equipment.data.items[item].itemInstanceId, itemId: equippedAndUnequipped.equipment.data.items[item].itemHash});
                }
            }
        }

        //then get power level, damage type from components element
        for(const[key, data] of Object.entries(equippedAndUnequipped.itemComponents.instances.data)){
            for(const itemIndex in items){

                if(items[itemIndex].instance==key && items[itemIndex].item_type != "Subclass"){

                    items[itemIndex].damage=damageTypes[data.damageType];
                    items[itemIndex].power=data.primaryStat.value;

                }
            }
        }
        //then get perks (perks.data.perks), mods (sockets.data.sockets LIST) and stats (stats.data.stats) from item details
        var subclassdata = "";
        for(const item in items){
            const itemdata = await getItemData(access_token,memberid,membertype,items[item].instance);
            if(items[item].item_type==="Subclass"){
                subclassdata +="\n\n"+JSON.stringify(itemdata,null,4);
            }
            fs.writeFile("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/Example_Json/subclassdata_example.txt",subclassdata,err => {});
            var perks = [];
            if(items[item].item_type in ["Subclass","Modifications","General","Consumables"]){
                continue;
            }

            //Attach item perks
            if(!(typeof itemdata.Response.perks.data==="undefined")){//if the response includes perks for the item
                //Attach item perks
                for(const perkIndex in itemdata.Response.perks.data.perks){

                    for(const hashindex in perkHashes){

                        if(perkHashes[hashindex].hashid==itemdata.Response.perks.data.perks[perkIndex].perkHash){

                            perks.push({name: perkHashes[hashindex].name, desc:perkHashes[hashindex].description});
                        }
                    }
                }
            }
            items[item].perks = perks;

            //Attach item stats
            var stats = [];
            for(const statIndex in itemdata.Response.stats.data.stats){

                for(const hashIndex in statHashes){

                    if(statHashes[hashIndex].hashid==itemdata.Response.stats.data.stats[statIndex].statHash){

                        stats.push({name: statHashes[hashIndex].name, desc:statHashes[hashIndex].description, value: itemdata.Response.stats.data.stats[statIndex].value});
                    }
                }
            }
            items[item].stats = stats;

            //attach item names
            const cached_item = itemNameHashes.find(itm => itm.hashid==items[item].itemId);
            items[item].name=cached_item.name;

            //get subclass fragments
            if(items[item].item_type==="Subclass"){
                var fragments=[];
                for(const socket in itemdata.Response.sockets.data.sockets){
                    const cached_perk = perkHashes.find(prk => prk.hashid==itemdata.Response.sockets.data.sockets[socket].plugHash);
                    fragments.push(cached_perk);
                }
                items[item].fragments = fragments;
            }

        }
        return seperateItems(items);
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
function parseItemResponse(response){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getEquippedItems(characterid,membershipid,membertype,access_token){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getUnEquipped(characterid,membershipid,membertype,access_token){

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
 * @returns {Promise<void>} A list of objects with {typeName: string, precision kills: int, normal kills: int}
 */
async function getAccountWeaponStats(membershipid,membertype,access_token, pve){

    const flags = {
        "MEMBERTYPE": membertype,
        "MEMBERID": membershipid
    };

    const final_url = replaceMultiple(/MEMBERTYPE|MEMBERID/g,flags,weapon_stats_url);
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

    try{
        const res = await fetch(url, {
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

    const response = await protectedRequest(null,manifest_url,"Requesting Manifest data",false);
    manifestData = response;//bucket hashes is the first init method called, so cache the result so subsequent init methods can use it
    if(response=="error"){

        console.log("Error in retrieving maifest data");
        return "error";

    }else{

        var def_url = base_domain+response.Response.jsonWorldComponentContentPaths.en.DestinyInventoryBucketDefinition;
        const definitions = await protectedRequest(null,def_url,"Request bucket definitions",false);

        if(definitions=="error"){

            console.log("Error in retrieving bucket definitions");
            return "error";

        }else{

            Object.entries(definitions).forEach(([hash,data])=>{//for every bucket hash returned

                if(data.hasOwnProperty("displayProperties")){//if the hash is user-facing and therefore one of the ones we look for

                    if(!(typeof data.displayProperties.name==="undefined")){//name element may not exist for some display properties we check, so omit these to avoid errors later

                        for(var bucket in relevant_buckets){

                            if(relevant_buckets[bucket]==data.displayProperties.name){

                                bucketHashes.push({hashid: hash, name: data.displayProperties.name});

                            }
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

    const perkResponse = await protectedRequest(null,base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinySandboxPerkDefinition,"Perk Hash Request",false);
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
    const statResponse = await protectedRequest(null, base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyStatDefinition, "Stats Hash Request",false);
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
    const modifierHashes = await protectedRequest(null,base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityModifierDefinition,"Activity Modifiers",false);

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
    const typeHashes = await protectedRequest(null,base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityTypeDefinition,"Activity Type",false);
    for(const[type_hash, value] of Object.entries(typeHashes)){
        activityTypeHashes.push({
           hash: type_hash,
           name: value.displayProperties.name
        });
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getActivityDefinitions(){
    const activityResponse = await protectedRequest(null,base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyActivityDefinition,"Activity Definitions",false);

    for(const[activity_hash, hash] of Object.entries(activityResponse)){
        if(hash.displayProperties.name=="Classified"){
            continue;
        }
        staticActivities.push({
            hash: activity_hash,
            name: hash.displayProperties.name,
            type: (activityTypeHashes.find(type => type.hash == hash.activityTypeHash)).name,
            description: hash.displayProperties.description,
            isPlaylist: hash.isPlaylist

        });
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ALL ITEMS IN THE GAME, INCLUDING THEIR NAME, HASH ID AND DESCRIPTION
*/
async function getItemDefinitions(){
    const itemsResponse = await protectedRequest(null, base_domain+manifestData.Response.jsonWorldComponentContentPaths.en.DestinyInventoryItemDefinition, "Item Hash Request",false);
    if(itemsResponse=="error"){
        return "error";
    }

    for(const[key, properties] of Object.entries(itemsResponse)) {//for every stat

        itemNameHashes.push({
            hashid: key,
            name: properties.displayProperties.name,
            description: properties.displayProperties.description
        });
    }
    return "success";
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getMilestoneActivities(){
    const milestones = await protectedRequest(null,base_domain+"/Platform/Destiny2/Milestones/","Milestones Request",false);

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
                name: foundActivity.name,
                description: foundActivity.description,
                modifiers: modifiers
            });
        }
    }
    //console.log(JSON.stringify(activeActivities,null,4));

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



}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

await moduleInit();//initialise module

export const destiny_full = {
    getCharacterInventoryItemsAndVault,
    set_dependencies,
    getNewUser,
    getAccountWeaponStats
}

export default {getUserAccess,getAccountCharacters,getAccountSpecificData,getPlayerInventoryItems,getCharacterInventoryItemsAndVault};