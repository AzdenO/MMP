/**
 * @module ParserTests
 * @description Module dedicated to performing a set of tests to verify the parsing ability
 * of BungieParser.mjs, a core module of the server. Any updates to the Bungie API will require refreshing the BungieAPI responses
 * located in the TestData directory. The same applies to any changes to game content since last test session and static
 * game data files will need to be reloaded
 * @version 0.2.1
 * @author Declan Roy Alan Wadsworth
 */
import fs from "node:fs";//for reading test data
import * as Parser from "../modules/utils/bungieParser.mjs";//import parser module
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Exporting function to perform all tests privatized by this module
 */
export function testParser() {
    /*
     * Load and set example static game data
     */
    const activeActs = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ActiveActivities.json", "utf8", function(err, data) {}));
    const modifiers = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ActivityModifiers.json", "utf8", function(err, data) {}));
    const buckets = JSON.parse(fs.readFileSync("../TestData/StaticGameData/BucketHashes.json", "utf8", function(err, data) {}));
    const items = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ItemHashes.json", "utf8", function(err, data) {}));
    const perks = JSON.parse(fs.readFileSync("../TestData/StaticGameData/PerkHashes.json", "utf8", function(err, data) {}));
    const stats = JSON.parse(fs.readFileSync("../TestData/StaticGameData/StatHashes.json", "utf8", function(err, data) {}));
    const activities = JSON.parse(fs.readFileSync("../TestData/StaticGameData/StaticActivities.json", "utf8", function(err, data) {}));

    Parser.setGameData(activities,modifiers,activeActs,items,perks,stats,buckets);

    testEquippedItemParsing();
    testWeaponStatsParsing();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @test 0001
 * @description Ability to parse a characters equipped items
 *
 */
function testEquippedItemParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleEquippedItems.json", "utf8", function(err, data) {
        console.log(err);
    });

    const expected = fs.readFileSync("../TestData/ParsedBungieResponses/exampleEquippedItemsParsed.json", "utf8", function(err, data) {})

    let parsed = Parser.parseItems(JSON.parse(data),"equipment");

    if(expected === JSON.stringify(parsed)){
        console.log("Equipped Item Parsing Successful");
    }else{
        console.log("Equipped Item Parsing Failed");
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @test 0002
 * @description Ability to parse a characters unequipped items
 *
 */
function testUnEquippedItemParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleUnEquippedItems.json", "utf8", function(err, data) {})
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @test 0003
 * @description Ability to parse a players vault items
 *
 */
function testVaultParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleVaultItems.json", "utf8", function(err, data) {})

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @test 0004
 * @description Ability to parse a players weapon statistics
 *
 */
function testWeaponStatsParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/PlayerWeaponStatistics.json", "utf8", function(err, data) {})
    let parsed = Parser.parseWeaponStats(JSON.parse(data));
    fs.writeFile("../TestData/ParsedBungieResponses/parsedWeaponStats.json", JSON.stringify(parsed), "utf8", function(err, data) {})
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @test 0005
 * @description Ability to parse a player characters activity history
 *
 */
function testPgcrParsing(){
    const data = fs.readFile("../TestData/BungieResponses/ExamplePGCRs.json", "utf8", function(err, data) {})

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
testParser();