/**
 * @module ReasonerTests
 * @description Module to quickly generate coaching content for validation test
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth
 */
import Reasoner from '../modules/reasoner.mjs';
const testInstance = new Reasoner();
import {seperateItems} from "../modules/utils/listUtils.js";
import fs from "node:fs";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchCharacterAnalysisResponse(){
    const read = fs.readFileSync("../TestData/ParsedBungieResponses/exampleEquippedItemsParsed.json", "utf8");
    const data = JSON.parse(read);
    const seperated = seperateItems(data);
    const response = await testInstance.characterAnalysis({
        armors: seperated[0],
        weapons: seperated[1],
        subclasses: seperated[2]
    });
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchActivityAnalysisResponse(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchWeaponSkillsResponse(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
fetchCharacterAnalysisResponse();
