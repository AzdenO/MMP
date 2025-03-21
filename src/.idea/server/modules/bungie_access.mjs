//////////////////////////////////////////REQUIRED MODULES////////////////////////////////////////////////
import env from "dotenv";//safely storing of secrets
import fs from "node:fs";//for writing to files, not technically necessary apart from when saving responses from bungie to look at more easily
env.config();
/////////////////////////////////////////LOAD API ENVIRONMENT VARIABLES///////////////////////////////////
const apikey = process.env.D2_API_KEY;
const clientid = process.env.D2_CLIENT_ID;//doesnt need to be a secret but is of the theme so might as well store it here
const clientsecret = process.env.D2_CLIENT_SECRET;
/////////////////////////////////////////COMMON ENDPOINTS/////////////////////////////////////////////////
const base_domain="https://www.bungie.net";
const user_access_token = "https://www.bungie.net/Platform/App/oauth/token/";//pass an auth code from OAuth2 to receive access and refresh tokens
const user_inventory_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/Character/CHARACTERID/?components=201,202,205,300";
const user_account_data = "https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/";
const user_data_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/?components=COMPONENTS";//for getting characters, vault data, etc.
const item_data_url = "https://www.bungie.net/Platform/Destiny2/TYPE/Profile/MEMBERID/Item/ITEMID/?components=300,302,304,305";
const manifest_url = "https://www.bungie.net/Platform/Destiny2/Manifest/";//url for static game data, such as bucket hashes

var manifestData = null;//as part of module init, multiple calls would need to be made to the manifest endpoint. Caching the first request made to it saves time for subsequent requests for other module iniitialisation attributes
/////////////////////////////////////////////////////BUNGIE RETURN VALUES/////////////////////////////////

const classTypes = ["Titan","Hunter","Warlock"];//bungie only returns a number for the character class type. We use this number as the index of the array to return the actual class type
var bucketHashes = [];//bungie provides a bucket hash for each item which essentially defines the type of item, generated dynamically
const damageTypes=["Not Applicable","Kinetic","Arc","Solar","Void","Raid Damage","Stasis","Strand"];//every weapon has a numeric value for its damage type
var perkHashes = [];//bungie provides a hash for each perk on a weapon, which we query the manifest for to get its name
var statHashes = [];//bungie provides a hash value for every stat on a weapon or armor piece, we query the manifest for this static data
var plugHashes = [];
var itemNameHashes = [];//stores all items in the game, including their hash, name and description
////////////////////////////////////////MISCELLANEOUS VARIABLES///////////////////////////////////////////
const logbreak = "////////////////////";

//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* CREATE A NEW USER - IMPLEMENTED AT A LATER DATE FOR BETTER USER INSTANTIATION FLOW (NEW AND CURRENT USERS)
* Function called by the coach that encompasses all necessary function calls, and returns all data in an object the coach
* object will store as an attribute
*/
async function createNewUser(){

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET BUNGIE AUTHENTICATION
* Method for getting authorisation from the bungie api, to make requests for the user associated with the authorisation code
* or if the user is already in the server database, using their refresh token to exchange this for an active access token.
* If the refresh token is at its default, this is interpreted as a new server user
*/
async function getUserAccess(refreshToken=null,auth_code) {
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
                console.log("Token Request Bad:\n///////////////////////////////////////////////////////////////////////////")
                console.log(consumed.message);//log message bungie returns for more detail on what went wrong
                return "error";
            }
            else{
                const consumed = await res.json();
                console.log("Token Request Good:\n//////////////////////////////////////////////////////////////////////////")
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

    console.log(logbreak+"\nRetrieving user account data\n"+logbreak);
    console.log("Making request to: "+user_account_data);

    const response = await protectedRequest(access_token,user_account_data,"Account Data Request");
    return response;
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
* GET ACCOUNT CHARACTERS
* Function that requests users characters, and parses the response to be held in the coach object at the end of function call
*/
async function getAccountCharacters(access_token,membershipid,membertype){

    console.log(logbreak+"\nRetrieving user characters\n"+logbreak);
    //replace url dyanmic components with user data
    const url_construct = user_data_url;
    const phase1_url_construct = url_construct.replace("TYPE",membertype);
    const phase2_url_construct = phase1_url_construct.replace("MEMBERID",membershipid);
    const final_url = phase2_url_construct.replace("COMPONENTS","200");
    console.log("Making request to: "+final_url);

    const response = await protectedRequest(access_token,final_url,"Account Characters Request");
    var characterlist = [];
    Object.entries(response.Response.characters.data).forEach(([element, data]) => {//iterate through character objects dynamically
        characterlist.push([data.characterId,data.light,classTypes[Number(data.classType)]]);
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

    console.log(logbreak+"\nRetrieving character inventory for character: "+characterid+"\n"+logbreak);//log action

    //construct URL with user specific data
    const url_construct = user_inventory_url;
    const phase1_url_construct = url_construct.replace("TYPE",membertype);
    const phase2_url_construct = phase1_url_construct.replace("MEMBERID",memberid);
    const final_url = phase2_url_construct.replace("CHARACTERID",characterid);
    console.log("Making request to: "+final_url);

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
        return items;
        //console.log(JSON.stringify(items,null, 4));
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
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
/*
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
            console.log(logtext+" Bad:\n"+logbreak);
            var consumed = await res.json();
            console.log(JSON.stringify(consumed,null,4));
            return "error";
        }
        else{
            var consumed = await res.json();
            console.log(logtext+" Good:\n"+logbreak);
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
/*
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
/*
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
/*
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
/*
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
async function getModHashes(){

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
/*
* INITIALISE MODULE
* Private module method that encompasses all method calls relevant for initialising the module for use,
* such as initialising the bucket hashes list, which some module methods will use
*/
async function moduleInit(){

    console.log("\nBungie Access Initialisation...");

    console.log("Acquiring relevant bucket hashes...\n");
    if(await getAllBucketHashes()==="success"){console.log("Acquired bucket hashes")}else{console.log("Error in acquiring buckets")}//instantiate bucket hashes array, providing the hash value and the relevant name in a key value store

    console.log("Acquiring subclass hashes...\n");

    //await getSubClassHashes();//non-functioning atm, I have to parse a 272mb file, and I dont wanna do that, if the devil exists, hes a json response

    console.log("Acquiring perk hashes...\n");
    if(await getPerkHashes()==="success"){console.log("Acquired perk hashes")}else{console.log("Error in acquiring perks")};

    console.log("Acquiring stat hashes...\n");
    if(await getStatHashes()==="success"){console.log("Acquired stat hashes")}else{console.log("Error in acquiring stats")};

    console.log("Acquiring all game items...\n");
    if(await getItemDefinitions()==="success"){console.log("Acquired all game items")}else{console.log("Error in acquiring game items")};

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////

await moduleInit();//initialise module

export default {getUserAccess,getAccountCharacters,getAccountSpecificData,getPlayerInventoryItems,getCharacterInventoryItemsAndVault};