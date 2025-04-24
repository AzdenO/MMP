import {GoogleGenAI, Type} from "@google/genai";
import fs from "node:fs";
import env from "dotenv";
import {replaceMultiple} from "./utils/stringUtils.js";
import {PromptIndexes} from "./Enums/PromptIndexes.mjs";
import {ReasonerError} from "./utils/errors.mjs";
export default class Reasoner{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(){

        env.config();
        this.generator = new GoogleGenAI({apiKey: process.env.AI_API_KEY});
        this.#loadPrompts();
        this.#loadSchemas();
        this.model = "gemini-2.0-flash";

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Load pre-structured prompts from .txt file at /resources/ReasonerResources/prompts.txt, called at object instantiation
     */
    #loadPrompts(){
        const promptstream = fs.readFileSync("O:/Dev/Level_4/VanguardMentorServer/src/.idea/server/resources/ReasonerResources/prompts.txt", "utf8");
        this.prompts = promptstream.split("/--/");
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async testPrompting(){
        const result = await this.bot.generateContent(this.prompts[1])
        console.log(result.response.text());
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to generate AI content that evaluates a players general activity skills, focusing on analysing a players
     * entire activity history, looking at what the player takes part in the most
     * @param {Object} history An object containing a verbose entry for every activity summary the player has taken part in
     *
     * @returns {Promise<Object>} The response object from the reasoner
     */
    async activitySkills(history){
        const promptParams = {
            "-HISTORY-": JSON.stringify(history,null,4)
        }
        const prompt = replaceMultiple(/-HISTORY-/g, promptParams, this.prompts[PromptIndexes.ACTIVITY_SKILLS]);
        const schema = this.schemas.ActivitySKills;
        const result = await this.#generate(
            prompt,
            schema,
            0
        );
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to generate AI content for suggesting a character build for a specific activity
     * @param {Object} activity An object containing activity.modifiers and activity.name
     * @param {Object} items An object with two properties items.character and items.vault
     * @param {string} character_class The character class to suggest a build for
     * @returns {Promise<Object>} content to return to a client
     */
    async act_build(activity, items, character_class){
        const promptParams = {
            "-CHARACTER-": items.character,
            "-CLASS-": character_class,
            "-ACTIVITY-": activity.name,
            "-MODIFIERS": activity.modifiers,
            "-VAULT-": JSON.stringify(items.vault,null,4)
        }
        const prompt = replaceMultiple(/-CHARACTER-|-CLASS-|-ACTIVITY-|-MODIFIERS-|-VAULT-/g, promptParams, this.prompts[PromptIndexes.ACTIVITY_BUILD]);
        const result = await this.#generate(
            prompt,
            this.schemas.activityBuildSchema,
            1
        );
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async weaponSkills(stats){
        const promptParams = {
            "-STATISTICS-": JSON.stringify(stats,null,4)
        }
        const prompt = replaceMultiple(/-STATISTICS-/g,promptParams,this.prompts[PromptIndexes.WEAPON_SKILLS]);
        const result = await this.#generate(
            prompt,
            this.schemas.weaponSkills,
            0
        )
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async keywordDescription(keyword, type){
        const promptParams = {
            "-KEYWORD-": keyword,
            "-KEYWORDTYPE-": type
        }
        var schema = null;
        switch(type){
            case "ActivityType":
                schema = this.schemas.ActivityTypeKeywordSchema;
                break;
            default:
                throw new ReasonerError("Keyword type not supported", "INVALID_KEYWORD_TYPE");
                break;
        }
        const prompt = replaceMultiple(/-KEYWORD-|-KEYWORDTYPE-/g,promptParams,this.prompts[PromptIndexes.ACTIVITY_TYPE_KEYWORD]);
        const result = this.#generate(
            prompt,
            schema,
            0
        );
        return result;
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
        const prompt = replaceMultiple(/-ARMOR-|-WEAPONS-|-SUBCLASS-|-ITEMS-/g,promptParams,this.prompts[PromptIndexes.CHARACTER_ANALYSIS]);
        const result = await this.#generate(
            prompt,
            this.schemas.characterAnalysis,
            0
        );
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to generate content that analyses a parsed Destiny 2 PGCR
     * @param {Object} activityData The pre-parsed PGCR with high verbosity for better reasoner integration
     * @returns {Promise<JSON>} The JSON response
     */
    async activityAnalysis(activityData){
        const promptParams = {
            "-ACTIVITY-": JSON.stringify(activityData,null,4)
        }
        const prompt = replaceMultiple(/-ACTIVITY-/g, promptParams, this.prompts[PromptIndexes.ACTIVITY_ANALYSIS]);

        const result = await this.#generate(
            prompt,
            this.schemas.ActivityAnalysis,
            0
        );
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to generate targets specific to a users overall statistics including weapon statistics, pve and pvp statistics
     * @param {{{Object} weapon,{Object} pve,{Object} pvp}} stats The object containing a property for each statistic piece
     * @returns {Promise<Object>} The response object from the reasoner
     */
    async generateTargets(stats){
        const promptParams = {
            "-WEAPON": stats.weapon,
            "ACTIVITY": stats.pve,
            "CRUCIBLE": stats.pvp
        }
        const prompt = replaceMultiple(/-WEAPON-|-ACTIVITY-|-CRUCIBLE-/g, promptParams,this.prompts[PromptIndexes.TARGETS]);
        const result = await this.#generate(
            prompt,
            this.schemas.generatedTargets,
            0
        );
        return result;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Method to configure Geminis generation of a response (such as specifying output JSON), and generate the content
     * @param {string} prompt The prompt
     * @param {Object} schema The schema for the output JSON
     * @param {number} temperature How deterministic the response should be, 0 is completely deterministic, 1 is completely
     * random
     * @returns {JSON} The content generated by the service
     */
    async #generate(prompt, schema, temperature){
        const response = await this.generator.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config:{
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: temperature,
            }
        });
        return JSON.parse(response.text);
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Load gemini response schemas from .json file at /resources/ReasonerResources/ResponseSchemas.json
     * @returns {Object} An object containing all response schemas
     */
    #loadSchemas(){
        var schemas = {};
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.StatusEffectKeywordSchema = {

        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.ActivityTypeKeywordSchema = {
            type: Type.ARRAY,
            items:{
                type: Type.OBJECT,
                properties:{
                    'description': {
                        type: Type.STRING,
                        description: 'Provide a detailed description of this activity type, including any possible enemies and the threats they pose and typical combat environments',
                        nullable: false,
                    },
                    'exampleactivities': {
                        type: Type.STRING,
                        description: 'Provide a list of example activities for this activity type',
                        nullable: false,
                    }
                },
                required: ['description', 'exampleactivities'],
            }
        }

        schemas.activityBuildSchema = {
            type: Type.ARRAY,
            items:{
                type: Type.OBJECT,
                properties:{
                    'build':{
                        type: Type.OBJECT,
                        properties:{
                            'subclass':{
                                type: Type.OBJECT,
                                properties:{
                                    'name':{
                                        type: Type.STRING,
                                        description: 'The name of the subclass',
                                        nullable: false,
                                    },
                                    'activityadvantage':{
                                        type: Type.STRING,
                                        description: 'What advantage does this subclass provide for this activity',
                                        nullable: false,
                                    },
                                    'meleeAbility':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the melee ability',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this melee ability provide for this activity, such as effectiveness at enemy types encountered, any activity modifiers, as well as any boost this ability gets from other aspects of this build such as faster regeneration of this ability",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the melee ability',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'grenadeAbility':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the grenade ability',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this grenade provide for this activity, such as effectiveness at enemy types encountered, any activity modifiers,combat environments, as well as any boost this ability gets from other aspects of this build such as faster regeneration of this ability",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the grenade ability',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'classAbility':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the class ability',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this class ability provide for this activity, such as effectiveness at enemy types encountered, any activity modifiers, bonuses to activity survivability, as well as any boost this ability gets from other aspects of this build such as faster regeneration of this ability",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the melee ability',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'jumpAbility':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the jump ability',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this jump ability provide for this activity, such as effectiveness in the activities caombat environments",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the jump ability',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'aspect1':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the aspect',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this aspect provide for this activity, such as effectiveness at enemy types encountered, any activity modifiers, as well as any boost this ability gets from other aspects of this build such as faster regeneration of this ability",
                                                nullable: false,
                                            },
                                            'producableEffects':{
                                                type: Type.STRING,
                                                description: "What status effects can this aspect produce for the player, and how does that effect benefit them",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the aspect',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'aspect2': {
                                        type: Type.OBJECT,
                                        properties: {
                                            'name': {
                                                type: Type.STRING,
                                                description: 'The name of the aspect',
                                                nullable: false,
                                            },
                                            'activityadvantage': {
                                                type: Type.STRING,
                                                description: "What advantage does this aspect provide for this activity, such as effectiveness at enemy types encountered, any activity modifiers, as well as any boost this ability gets from other aspects of this build such as faster regeneration of this ability",
                                                nullable: false,
                                            },
                                            'producableEffects': {
                                                type: Type.STRING,
                                                description: "What status effects can this aspect produce for the player, and how does that effect benefit them",
                                                nullable: false,
                                            },
                                            'description': {
                                                type: Type.STRING,
                                                description: 'The description of the aspect',
                                                nullable: false,
                                            }
                                        }
                                    },
                                    'fragments':{
                                        type: Type.ARRAY,
                                        description: 'List of fragments that you have suggested for this build',
                                        items:{
                                            type: Type.OBJECT,
                                            properties:{
                                                'name':{
                                                    type: Type.STRING,
                                                    description: 'The name of the fragment',
                                                    nullable: false,
                                                },
                                                'activityadvantage':{
                                                    type: Type.STRING,
                                                    description: "What advantage does this fragment provide for this activity, such as effectiveness at enemy types encountered,boosts to armor stats or damage output, any activity modifiers, as well as any boost this fragment gets from other aspects of this build such as extension of status effects",
                                                    nullable: false,
                                                },
                                                'description':{
                                                    type: Type.STRING,
                                                    description: 'The description of the fragment',
                                                    nullable: false,
                                                }
                                            }
                                        }
                                    },
                                    'superAbility':{
                                        type: Type.OBJECT,
                                        properties:{
                                            'name':{
                                                type: Type.STRING,
                                                description: 'The name of the fragment',
                                                nullable: false,
                                            },
                                            'activityadvantage':{
                                                type: Type.STRING,
                                                description: "What advantage does this fragment provide for this activity, such as effectiveness at enemy types encountered, activity modifier coherance, as well as any boost this super gets from other aspects of this build such as extended duration, quicker regeneration of super or increased output",
                                                nullable: false,
                                            },
                                            'description':{
                                                type: Type.STRING,
                                                description: 'The description of the fragment',
                                                nullable: false,
                                            }
                                        }
                                    }
                                }
                            },
                            'weapons':{
                                type: Type.ARRAY,
                                description: "a list of the weapons you have suggested for this build",
                                items:{
                                    type: Type.OBJECT,
                                    description: "each weapon you have suggested for this build, remember to only suggest a single exotic weapon",
                                    properties:{
                                        'name':{
                                            type: Type.STRING,
                                            description: "the name of this weapon",
                                            nullable: false,
                                        },
                                        'weaponslot':{
                                            type: Type.STRING,
                                            description: "The slot this weapon goes in, [kinetic slot, special slot, power slot], remember to only suggest a single weapon for each slot",
                                            nullable: false,
                                        },
                                        'activityadvantage':{
                                            type: Type.STRING,
                                            description: "What advantage does this weapon provide for this activity, taking into consideration the weapons stats, its type and the activity itself",
                                            nullable: false,
                                        },
                                    },
                                    required: ['name', 'weaponslot', 'activityadvantage'],
                                }
                            },
                            'armors':{
                                type: Type.ARRAY,
                                description: "a list of the armor pieces you have suggested for this build",
                                items:{
                                    type: Type.OBJECT,
                                    description: "each armor piece you have suggested you have suggested for this build, remember to only suggest a single exotic piece",
                                    properties:{
                                        'name':{
                                            type: Type.STRING,
                                            description: "the name of this armor piece",
                                            nullable: false,
                                        },
                                        'armorslot':{
                                            type: Type.STRING,
                                            description: "The slot this weapon goes in [helmet, legs, chest, arms, class armor], remember to only suggest a single armor piece for each slot",
                                            nullable: false,
                                        },
                                        'activityadvantage':{
                                            type: Type.STRING,
                                            description: "What advantage does this armor piece provide for this activity, taking into consideration the armor stats, any intrinsic traits for exotic armors, activity itself and the active perks",
                                            nullable: false,
                                        },
                                    },
                                    required: ['name', 'armorslot', 'activityadvantage'],
                                }
                            },
                            'summaryofbuild':{
                                type: Type.STRING,
                                description: "Give a summary of the build and the reason behind its configuration in the context of the activity, as well as its overall advantages and what it prioritises (such as survivability, damage output, etc.)",
                                nullable: false,
                            },
                            'statuseffects':{
                                type: Type.STRING,
                                description: "List all the status effects that this build can produce, brief summaries of how they are produced in the context of this build, and how they should be used in the context of this activity",
                                nullable: false,
                            }
                        },
                        required: ['name', 'subclass', 'weapons', 'armors', 'summaryofbuild', 'statuseffects'],
                    }
                }
            }
        }
        /////////////////////////////////////////////////////////////////////////
        schemas.weaponSkills = {
            type: Type.ARRAY,
            items:{
                type: Type.ARRAY,
                description: "each weapon type you suggest growing the players skill in",
                items:{
                    type: Type.OBJECT,
                    description: "This weapon type",
                    properties: {
                        'weapontype':{
                            type: Type.STRING,
                            description: "The name of the weapon type your suggesting",
                            nullable: false,
                        },
                        'advantages':{
                            type: Type.STRING,
                            description: "The overall advantages this weapon type provides in the game, what combat environments favor it, the enemies its most effective against and any other points you think applicable",
                            nullable: false,
                        },
                        'omittance':{
                            type: Type.STRING,
                            description: "How might the player face challenges for omitting this weapon type from their general arsenal, what environments might they face more struggles in",
                            nullable: false,
                        },
                        'practice':{
                            type: Type.ARRAY,
                            description: "an array of activities the player should practice more use of this weapon",
                            items:{
                                type: Type.OBJECT,
                                description: "an object for each suggested practice activity",
                                properties:{
                                    'activity':{
                                        type: Type.STRING,
                                        description: "The name of the activity",
                                        nullable: false,
                                    },
                                    'description':{
                                        type: Type.STRING,
                                        description: "A brief description of the activity, its environments and enemies and how it poses itself as a good practice activity",
                                        nullable: false,
                                    }
                                },
                                required: ['activity', 'description'],
                            }
                        }
                    },
                    required: ['weapontype', 'advantages', 'omittance','practice'],
                },

            }
        }
        //////////////////////////////////////////////////////
        schemas.ActivityAnalysis = {
            type: Type.OBJECT,
            properties:{
                'activitysummary':{
                    type: Type.STRING,
                    description: "A general description of this activity",
                    nullable: false,
                },
                'environment':{
                    type: Type.STRING,
                    description: "An analysis of the environments found in this activity and what challenges they pose",
                    nullable: false,
                },
                'teamperformance':{
                    type: Type.STRING,
                    description: "A general analysis of the team performance in this activity, only if the activity data passed includes other participants",
                    nullable: true,
                },
                'WeaponAnalysis':{
                    type: Type.OBJECT,
                    description: "A detailed analysis of the weapons used in this activity",
                    properties:{
                        'distribution':{
                            type: Type.STRING,
                            description: "A detailed analysis of the distribution of kills between weapons",
                            nullable: false,
                        },
                        'weapons':{
                            type: Type.ARRAY,
                            description: "an array containing an entry for each weapon the player used",
                            items:{
                                type: Type.OBJECT,
                                description: "an object for each weapon",
                                properties: {
                                    'name': {
                                        type: Type.STRING,
                                        description: "The name of this weapon",
                                        nullable: false,
                                    },
                                    'weaponEffectiveness':{
                                        type: Type.STRING,
                                        description: "An analysis of the effectiveness of this weapon in this activity as well as if the player took full advantage of its capabilities",
                                        nullable: false,
                                    },
                                    'modifierCompliance':{
                                        type: Type.STRING,
                                        description: "does this weapon and its damage type comply with any modifiers present for this activity. Omit this if no modifiers were present",
                                        nullable: true,
                                    },
                                    'distributionShare':{
                                        type: Type.STRING,
                                        description: "A detailed analysis of the share of overall distribution of kills, is this dsitribution acceptable for the activity and its environments, or should the distribution be different",
                                        nullable: false,
                                    },
                                },
                                required: ["distributionShare","weaponEffectiveness","name"],
                            }
                        },

                    },

                },
                'combatAnalysis': {
                    type: Type.STRING,
                    description: "General analysis of the players combat ability for this activity, whether they did their fair share of work in the overall distribution of kills between players, and how many deaths they experienced",
                    nullable: false,
                },
                'duration':{
                    type: Type.STRING,
                    description: "An analysis of the duration of this activity, how long it took to complete, how long it took to complete, whether this could be improved or is acceptable. This can be omitted if the activity was PvP e.g. it was a crucible match",
                    nullable: true,
                },
                required: ["environment", "teamperformance", "WeaponAnalysis", "activitysummary", "combatAnalysis", "duration"],
            }
        }
        /////////////////////////////////////////////////////
        schemas.generatedTargets = {
            type: Type.ARRAY,
            description: "A list of the targets you have generated",
            items:{
                type: Type.OBJECT,
                description: "A target",
                properties:{
                    'name':{
                        type: Type.STRING,
                        description: "Generate a name for this target that fits the context of Destiny 2, using themes and key aspects of the game",
                        nullable: false,
                    },
                    'targetvalue':{
                        type: Type.NUMBER,
                        description: "The realistically achievable value you have selected for this target that would improve a players profficiency",
                        nullable: false,
                    },
                    'description':{
                        type: Type.STRING,
                        description: "A brief description of what this target is for, such as complete x amount of night falls, get x amount of kills, etc."
                    },
                    required: ['name', 'targetvalue','description'],
                }
            }
        }
        /////////////////////////////////////////////////////

        /////////////////////////////////////////////////////
        this.schemas = schemas;
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}