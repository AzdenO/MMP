/**
 * @module ParserTests
 * @description Module dedicated to performing a set of tests to verify the parsing ability
 * of BungieParser.mjs, a core module of the server. Any updates to the Bungie API will require refreshing the BungieAPI responses
 * located in the TestData directory
 * @version 0.2.0
 * @author Declan Roy Alan Wadsworth
 */
import fs from "node:fs";//for reading test data
import * as Parser from "../modules/utils/bungieParser.mjs";//import parser module
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Exporting function to perform all tests privatized by this module
 */
export function testParser() {
    const activeActs = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ActiveActivities.json", "utf8", function(err, data) {}));
    const modifiers = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ActivityModifiers.json", "utf8", function(err, data) {}));
    const buckets = JSON.parse(fs.readFileSync("../TestData/StaticGameData/BucketHashes.json", "utf8", function(err, data) {}));
    const items = JSON.parse(fs.readFileSync("../TestData/StaticGameData/ItemHashes.json", "utf8", function(err, data) {}));
    const perks = JSON.parse(fs.readFileSync("../TestData/StaticGameData/PerkHashes.json", "utf8", function(err, data) {}));
    const stats = JSON.parse(fs.readFileSync("../TestData/StaticGameData/StatHashes.json", "utf8", function(err, data) {}));
    const activities = JSON.parse(fs.readFileSync("../TestData/StaticGameData/StaticActivities.json", "utf8", function(err, data) {}));
    Parser.setGameData(activities,modifiers,activeActs,items,perks,stats,buckets);
    testEquippedItemParsing();
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function testEquippedItemParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleEquippedItems.json", "utf8", function(err, data) {
        console.log(err);
    })
    let parsed = Parser.parseItems(JSON.parse(data),"equipment");
    fs.writeFile("../TestData/ParsedBungieResponses/exampleEquippedItemsParsed.json", JSON.stringify(parsed), function(err) {})
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function testUnEquippedItemParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleUnEquippedItems.json", "utf8", function(err, data) {})
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function testVaultParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/exampleVaultItems.json", "utf8", function(err, data) {})

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function testWeaponStatsParsing(){
    const data = fs.readFileSync("../TestData/BungieResponses/PlayerWeaponStatistics.json", "utf8", function(err, data) {})

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function testPgcrParsing(){
    const data = fs.readFile("../TestData/BungieResponses/ExamplePGCRs.json", "utf8", function(err, data) {})

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
testParser();