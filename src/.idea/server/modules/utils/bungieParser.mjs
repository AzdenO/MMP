/**
 * @module bungieParser
 * @description Module that recieves JSON parsed responses from the bungie_access module, extracts necessary information
 * and converts into an internal object format used server wide
 * @bungieApiVersion 1.20.1
 * @version 0.5.2
 * @author Declan Roy Alan Wadsworth (drw8)
 */

/*
 * utility function for converting static data as well as data objects part of large JSON payloads into hash maps for O(1) lookup times
 */
import {convertToMap} from "./listUtils.js";
/*
 * Utility function for implementing delays
 */
import {delay} from "./timeUtils.mjs";
/*
 * Constant objects containing game data not retrievable from the Bungie API
 */
import {modeTypes,damageTypes, itemSubTypes} from "../constants/BungieConstants.mjs";
/*
 * File writing purposes,
 */
import * as fs from "node:fs";


/*
 * Collection of global variables to hold hash maps of static game data
 */
var activityIDs = null;

var activeActivites = null;

var activityModifiers = null;

var bucketHashes = null;

var statHashes = null;

var perkHashes = null;

var gameItems = null;

var DEBUG = false;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to parse the object returned as a response from the bungie API Destiny2.getHistoricalStats endpoint, specifically
 * with the "group=Weapons" query string parameter
 * @param object The object (after json.parse) containing all weapon statistics as a collection of objects, with each weapon type having sperate objects for normal kills, precision kills, and precision kills as a percentage of total kills (this last type is ignored by the function)
 * @returns {Array} An array of key-values (objects) in the form of {weapontype: string, precisionkills: int, normal kills: int}
 */
//auto rifle, Beam Rifle, Bow, Glaive, Fusion Rifle, Grenades, Hand Cannon, Melee, pulse rifle, rocket launcher,
export function parseWeaponStats(object){
    var prefixes = ["weaponPrecisionKills","weaponKills"];
    //The object provided
    delete object.activitiesEntered;//is the second object in the collection and will mess with iterating through entries
    var results = [];//variable to hold collected results
    for(const [keyVal, weaponType] of Object.entries(object)){//first get all weapon types
        if(keyVal.startsWith(prefixes[0])){
            results.push({
                WeaponType: keyVal.slice(prefixes[0].length),
                PrecisionKills: weaponType.basic.value
            });
        }else if(keyVal.startsWith(prefixes[1])){
            for(const appended in results){
                if(results[appended].WeaponType == keyVal.slice(prefixes[1].length)){
                    results[appended].Kills = weaponType.basic.value;
                    break;
                }
            }
        }else{
            break;
        }

    }
    fs.writeFile("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/TestData/ParsedBungieResponses/ParsedWeaponStats.json",JSON.stringify(results),err => {});

    return results;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to parse a collection of PGCRs from a players recent activities
 *
 * @param {Array<Object>} pgcrArray An array containing PGCRs (Post Game Carnage Report)
 *
 * @param  {string} player The characterId of the player we requested activty results for. This is important for the PGCR,
 * as all players in the activity are identified by the character id, and this method fetches results for our player, not
 * other players
 *
 * @returns results An array of objects in the form
 */
export function parseActivityHistory(pgcrArray, player){
    var actCount = 0;
    var notCompleted = 0;
    var freshStart = 0;
    if(DEBUG){
        let read = fs.readFileSync("O://examplepGCRs.txt","utf8");
        pgcrArray = JSON.parse(read);
    }


    var results = [];//array to return

    for(const activity of pgcrArray){//for every activity we have been given a PGCR report for
        actCount++;//counting pgcr number, not current result array length as some activity entries will have been skipped
        let year = (activity.Response.period).split("T")[0].split("-")[0];
        if(year<2021){//ignore dated activities, responses for these are usually inconsistent, with weapons, activities and other aspects being sunset meaning PGCRs arent accurate
            continue;
        }
        //error handling. Sometimes the API returns erroneous activity summaries, and therefore has no equivalent in the hash map of all activities in the game. These anamolous objects usually have all values set to 0
        if(typeof activityIDs[activity.Response.activityDetails.referenceId]==="undefined"){
            continue;
        }

        var fetched = activeActivites[activity.Response.activityDetails.referenceId];//create reference to activity details
        if(typeof fetched == "undefined"){
            fetched=activityIDs[activity.Response.activityDetails.referenceId];
        }
        var weapons = [];//array to store weapons and weapon details in
        var ourPlayer = null;//reference to our player in the PGCR, just for better readability, rather than accessing deep nesting
        var participantData ={
            weapons:[]

        };//object to hold data such as kills, weapons, deaths and such from the other players in the activity
        var participantCount = 1;
        for(const players of activity.Response.entries){//PGCR returns all players in activity, find our player

            if(players.characterId == player){

                ourPlayer = players;
            }else{
                let other = players;
                participantData["Player "+participantCount+" Kills"]=other.values.kills.basic.value;
                participantData["Player "+participantCount+" Assists"]=other.values.assists.basic.value;
                participantData["Player "+participantCount+" Deaths"]=other.values.deaths.basic.value;
                if(other.extended.weapons){
                    for(const weapon of other.extended.weapons){
                        const fetched = gameItems[weapon.referenceId];
                        participantData.weapons.push({
                            Owner: "Player "+participantCount,
                            Name: fetched.name,
                            Damage: fetched.damage,
                            Kills: weapon.values.uniqueWeaponKills.basic.value,
                            Precision: weapon.values.uniqueWeaponKillsPrecisionKills.basic.value,
                        })
                    }
                }
                participantCount++;
            }
        }
        if(ourPlayer.values.completed.basic.value==0){//skip activities the player has not completed or where the activity was started part-way through/slash player leaves
            if(!activity.Response.activityWasStartedFromBeginning){
                freshStart++;
            }
            if(ourPlayer.values.completed.basic.value==0){
                notCompleted++;
            }
            continue;
        }


        if(typeof ourPlayer.extended.weapons == "undefined"){//some missions arent really missions. There is no real indicator apart from missing PGCR attributes, so we check if weapon data exists, if it doesnt, it probably wasnt a real mission and if it is, we want activity weapon data, otherwise anything the AI does or any stats we calculate would be moot
            continue;
        }


        for(const weapon of ourPlayer.extended.weapons){
            const fetched = gameItems[weapon.referenceId];
            weapons.push({
                Name: fetched.name,
                Damage: fetched.damage,
                Kills: weapon.values.uniqueWeaponKills.basic.value,
                Precision: weapon.values.uniqueWeaponKillsPrecisionKills.basic.value,
            })
        }
        let actType = modeTypes[activity.Response.activityDetails.mode];
        if(!actType){
            actType = "reserved";
        }

        results.push({
            Hash: activity.Response.activityDetails.instanceId,
            Date: activity.Response.period,//date of the activity
            Activity: fetched.name,//activity name
            TotalActivityKills: ourPlayer.values.kills.basic.value+participantData.kills,//total kills for this activity across all players
            Type:  actType,//the activity type
            Modifiers: fetched.modifiers,//any modifiers present for this activity
            Position: ourPlayer.standing,//our players standing in this activity
            Assists: ourPlayer.values.assists.basic.value,//the assists our player got
            Kills: ourPlayer.values.kills.basic.value,//the amount of kills our player got
            Deaths: ourPlayer.values.deaths.basic.value,//how many deaths our player experienced
            Completed: ourPlayer.values.completed.basic.displayValue,//was thisa ctivity completed
            Duration: ourPlayer.values.activityDurationSeconds.basic.displayValue,//the time it took to complete this activity
            WeaponData: weapons,//the weapons the player used for this activity and their share of enemy kills
            KillData: {//other kill data for non-weapons
                Grenade: ourPlayer.extended.values.weaponKillsGrenade.basic.value,
                Melee: ourPlayer.extended.values.weaponKillsMelee.basic.value,
                Super: ourPlayer.extended.values.weaponKillsSuper.basic.value
            },
            OtherParticipants: participantData,//the data for other participants including kills and weapons used

        });
    }
    fs.writeFile("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/TestData/ParsedBungieResponses/ParsedPGCRs.json",JSON.stringify(results),err => {});
    return results;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function which takes as a parameter an array of PGCR objects that have been pre-parsed by the parseActivityHistory function.
 * This function will provide all necessary activity statistics such as the number of completions for different activity types,
 * kills in each activity, and so on
 * @param parsedPGCRs An array of objects corresponding to a PGCR that has been parsed by the parseActivityHistory function
 * @author Declan Roy Alan Wadsworth (drw8)
 */
export function parseActivityStatistics(parsedPGCRs){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to parse a bungie Destiny2.getCharacter response for all items into a standardised format. This method assumes
 * the response is made with the stat, plug and perk query components
 * @param object the response object
 * @param key the key string of the response object to access, such as inventory or equipment for parsing items from different
 * locations
 */
export function parseItems(object, key){

    const exclusions = ["Lost Items","Ships","Emotes","Quests","Ghost","Accessories","Vehicle","Clan Banners","Emblems","Finishers","Seasonal Artifact","Consumables","Modifications"]

    if(DEBUG){
        object = JSON.parse(fs.readFile("O://exampleEquippedItems.json",err => {}));
        key = "equipment";
    }
    var items = [];

    var components = convertToMap(Object.entries(object.Response.itemComponents.instances.data).map(([idstring, values])=>({
        instanceid: idstring,
        ...values,
    })),"instanceid");
    var statComponents = convertToMap(Object.entries(object.Response.itemComponents.stats.data).map(([idstring, values])=>({
        instanceid: idstring,
        ...values,
    })),"instanceid");
    var perkComponents = convertToMap(Object.entries(object.Response.itemComponents.perks.data).map(([idstring, values])=>({
        instanceid: idstring,
        ...values,
    })),"instanceid");
    var socketComponents = convertToMap(Object.entries(object.Response.itemComponents.sockets.data).map(([idstring, values])=>({
        instanceid: idstring,
        ...values,
    })),"instanceid");

    for(const[keystring, item] of Object.entries(object.Response[key].data.items)){
        const bucket = bucketHashes[gameItems[item.itemHash].slot];

        if(!bucket || exclusions.includes(bucket.name)){
            continue;
        }
        if(bucket.name == "Subclass"){
            const subclass = parseSubclass(item.itemInstanceId, item.itemHash, socketComponents);
            items.push(subclass);
        }
        if(!components[item.itemInstanceId]?.primaryStat){
            console.log("Skipping item");
            continue;
        }
        var parseditem = {
            instanceid: item.itemInstanceId,
            Type: gameItems[item.itemHash].type,
            Slot: bucket.name,
            Name: gameItems[item.itemHash].name,
            Power: components[item.itemInstanceId].primaryStat.value,
            DamageType: damageTypes[components[item.itemInstanceId].damageType]

        };
        var stats = [];
        for(const[statstring, stat] of Object.entries(statComponents[parseditem.instanceid].stats)){
            stats.push({
                Name: statHashes[stat.statHash].name,
                Description: statHashes[stat.statHash].description,
                Value: stat.value
            });
        }
        parseditem.stats = stats;
        var perks = [];
        const instancePerks = perkComponents?.[parseditem.instanceid]?.perks;
        if(instancePerks){
            for(const[perkstring, perk] of Object.entries(perkComponents[parseditem.instanceid].perks)){
                if(perk.visible){
                    perks.push({
                        Name: perkHashes[perk.perkHash].name,
                        Description: perkHashes[perk.perkHash].description,
                    })
                }
            }
            parseditem.perks = perks;
        }
        items.push(parseditem);
    }
    fs.writeFile("O://Dev/Level_4/VanguardMentorServer/src/.idea/server/TestData/ParsedBungieResponses/ParsedEquippedItems.json",JSON.stringify(items),err => {});
    return items;



}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Return an object containing activity details for the hash provided
 * @param {string} hash Maps to an activity in the game, and therefore what is stored in module memory
 */
export function fetchActivity(hash){
    return{
        details: {
            name: activeActivites[hash].name,
            description: activeActivites[hash].name,
        },
        modifiers: activeActivites[hash].modifiers
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to pass in arrays of all static game data such as activities, modifiers, perks, bucket hashes, weapon details and more
 * @param activities An array of activity objects in the form of {}
 * @param itemNames
 * @param PerkNames
 */
export function setGameData(activities, activity_modfiers, activeActs, items, perks, stats, buckets){

    //convert all static game data arrays into hash maps for better searching efficiency
    activityIDs = convertToMap(activities, "hash");
    activityModifiers = convertToMap(activity_modfiers,"hash");
    activeActivites = convertToMap(activeActs,"hash");
    gameItems = convertToMap(items,"hashid");
    perkHashes = convertToMap(perks,"hashid");
    statHashes = convertToMap(stats,"hashid");
    bucketHashes = convertToMap(buckets,"hashid");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to parse a response object at the Destiny2.getHistoricalStats endpoint, returning a couple statistics relevant
 * to the coaching aspect of the server
 * @param {Object} object The response object to parse
 */
export function parseHistoricalStats(object){
    return {
        LongestKillSpree: object.Response.mergedAllCharacters.results.allPvE.allTime.longestKillSpree.basic.value,
        AverageLifeSpan: object.Response.mergedAllCharacters.results.allPvE.allTime.averageLifespan.basic.displayValue,
        winLossRatio: (object.Response.mergedAllCharacters.results.allPvP.allTime.winLossRatio.basic.value).toPrecision(2),
        bestSingleGameKills: object.Response.mergedAllCharacters.results.allPvP.allTime.bestSingleGameKills.basic.value,
        KDRatio: (object.Response.mergedAllCharacters.results.allPvP.allTime.killsDeathsRatio.basic.value).toPrecision(2),
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to parse the response receivied from bungies OAuth2 endpoint, extarcting tokens and their expiries
 * @param {Object} object The response json parsed into an object
 * @return {Object} A minimal object containing only the necessary data
 */
export function parseTokenResponse(object){
    return {
        memberID: object.membership_id,
        access: object.access_token,
        access_expiry: object.expires_in,
        refresh: object.refresh_token,
        refresh_expiry: object.refresh_expires_in
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Parse a subclass configuration
 * @param {string} subclassInstance The instance id of this subclass
 * @param {string} subclassNameHash The hash of this subclasses name in the manifest
 * @param {Map} sockets Map of all sockets from a parseItems instance, this could be changed in future for parse items to just
 * pass the sockets object for the subclass, instead of the entire map
 * @returns {Object} subclass configuration
 */
export function parseSubclass(subclassInstance, subclassNameHash, sockets){
    let subclassComponents = sockets[subclassInstance];
    var subclass= {
        Name: gameItems[subclassNameHash].name,
    }
    var count = 1;
    for(const socket of subclassComponents.sockets){
        if(socket.isEnabled && socket.isVisible){
            subclass["Component "+count+" Name"] = gameItems[socket.plugHash].name;
            subclass["Component "+count+" Description"] = gameItems[socket.plugHash].description;
        }
        count++;
    }
    return subclass;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////