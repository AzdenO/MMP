import {GoogleGenerativeAI} from "@google/generative-ai";
import fs from "node:fs";
import env from "dotenv";

export default class Reasoner{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(){

        env.config();
        const generator = new GoogleGenerativeAI(process.env.AI_API_KEY);
        this.bot = generator.getGenerativeModel({model: "gemini-2.0-flash"});
        this.prompts = this.#loadPrompts();

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    #loadPrompts(){
        const promptstream = fs.readFileSync("O:/Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/prompts.txt", "utf8");
        return promptstream.split("/--/");
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
}