import {GoogleGenerativeAI} from "@google/generative-ai";
import fs from "node:fs";
import env from "dotenv";
import {replaceMultiple} from "./utils/stringUtils.js";
export default class Reasoner{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(){

        env.config();
        const generator = new GoogleGenerativeAI(process.env.AI_API_KEY);
        this.bot = generator.getGenerativeModel({model: "gemini-2.0-flash"});
        this.#loadPrompts();

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    #loadPrompts(){
        const promptstream = fs.readFileSync("O:/Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/prompts.txt", "utf8");
        this.prompts = promptstream.split("/--/");
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async testPrompting(){
        const result = await this.bot.generateContent(this.prompts[1])
        console.log(result.response.text());
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /*
    * GENERATE CONTENT,
    */
    async act_build(activity, items, character_class){
        const prompt = this.prompts[2];
        const phase1 = prompt.replace("{LIST}",items);
        const phase2 = phase1.replace("{ACTIVITY}",activity);
        const final = phase2.replace("{CLASS}",character_class);
        console.log(final);
        const result = await this.bot.generateContent(final);
        console.log(result.response.text());
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async weaponSkills(stats){
        const promptParams = {
            "STATISTICS": JSON.stringify(stats,null,4)
        }
        const prompt = replaceMultiple(/STATISTICS/g,promptParams,this.prompts[3]);
        const result = await this.bot.generateContent(prompt);
        return result.response.candidates[0].content.parts[0].text;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to generate coach content analysing the character for a players current build
     * @param {Object} character A key-value store of the characters equipped items
     * @returns {Promise<JSON>} The generated JSON to be returned to the client
     */
    async characterAnalysis(character){
        const promptParams = {
            "-ARMOR-": JSON.stringify(character.Armors,null,4),
            "-WEAPONS-": JSON.stringify(character.Weapons,null,4),
            "-SUBCLASS-": JSON.stringify(character.Subclasses,null,4),
            "-ITEMS-": JSON.stringify(character.items,null,4)
        }
        const prompt = replaceMultiple(/-ARMOR-|-WEAPONS-|-SUBCLASS-|-ITEMS-/g,promptParams,this.prompts[5]);
        const result = await this.bot.generateContent(prompt);
        return result.response.candidates[0].content.parts[0].text;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}