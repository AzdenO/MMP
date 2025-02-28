const {GoogleGenerativeAI} = require("@google/generative-ai");
require('dotenv').config("O:/Dev/Level_4/OryxDashboard/src/.idea/.env");
const fs = require('fs');

class Reasoner{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(){
        console.log("Key"+process.env.AI_API_KEY);
        const generator = new GoogleGenerativeAI(process.env.AI_API_KEY);
        this.bot = generator.getGenerativeModel({model: "gemini-2.0-flash"});
        this.prompts = this.#loadPrompts();

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    #loadPrompts(){
        const promptstream = fs.readFileSync("O:/Dev/Level_4/OryxDashboard/src/.idea/server/resources/prompts.txt", "utf8");
        console.log(promptstream.split("/--/"));
        return promptstream.split("/--/");
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async testPrompting(){
        const result = await this.bot.generateContent(this.prompts[1])
        console.log(result.response.text());
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}

chat = new Reasoner();
chat.testPrompting();