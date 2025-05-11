import {GoogleGenAI, Type} from "@google/genai";
import fs from "node:fs";
import env from "dotenv";//external library (not developed by me) to load environment variables
import {replaceMultiple} from "./utils/stringUtils.js";
import {PromptIndexes} from "./Enums/PromptIndexes.mjs";
import {ReasonerError} from "./utils/errors.mjs";
export default class Reasoner{

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor(){

        env.config();
        this.generator = new GoogleGenAI({apiKey: process.env.AI_API_KEY});
        this.#loadPrompts();
        this.loadSchemas();
        this.model = "gemini-2.5-flash-preview-04-17";

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
            "-CHARACTER-": JSON.stringify(items.character,null,4),
            "-CLASS-": character_class,
            "-ACTIVITY-": "Activity Name: "+activity.details.name+" \nActivity Description: "+activity.details.description,
            "-MODIFIERS": JSON.stringify(activity.modifiers,null,4),
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
            case "Destination_Activities":
                schema = this.schemas.destinationActivities;
                break;
            case "Specific_Activity":
                scehma = this.schemas.specificActivitySchema;
                break;
            case "Seasonal_Activities":
                schema = this.schemas.seasonalActivities;
                break;
            case "Status_Effects":
                schema = this.schemas.StatusEffectKeywordSchema;
                break;
            case "Champions":
                schema = this.schemas.ChampionsKeywordSchema;
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
            "-SUBCLASS-": JSON.stringify(character.Subclasses,null,4)
        }
        const prompt = replaceMultiple(/-ARMOR-|-WEAPONS-|-SUBCLASS-/g,promptParams,this.prompts[PromptIndexes.CHARACTER_ANALYSIS]);
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
            model: this.model,
            contents: prompt,
            config:{
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: temperature,
            }
        });
        console.log("Reasoner:// Generation sucessfull")
        return JSON.parse(response.text);
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * Load gemini response schemas from .json file at /resources/ReasonerResources/ResponseSchemas.json
     * @returns {Object} An object containing all response schemas
     */
    loadSchemas(){
        var schemas = {};
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.SpecificActivitySchema = {
            type: Type.OBJECT,
            properties:{
                'description': {
                    type: Type.STRING,
                    description: "Provide a detailed description of this activity",
                    nullable: false,
                },
                'mechanics': {
                    type: Type.STRING,
                    description: "Give a detailed description of every mechanic that a player would face in this activity, and how they are completed",
                    nullable: false,
                },
                'rewards': {
                    type: Type.STRING,
                    description: "Provide a detailed description of every reward that a player would receive in this activity, including any exotics, and activity specific rewards such as weapons and armors",
                }
            }
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.seasonalActivities = {
            type: Type.OBJECT,
            properties:{
                'description': {
                    type: Type.STRING,
                    description: "Provide a detailed description of this seasonal activity, including what mechanics (if any) a player would face and potential rewards. Is there any seasonal items that can be used or configured to boost rewards or player combat ability in this activity?",
                    nullable: false,
                }
            },
            required: ['description'],
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.destinationActivities = {
            type: Type.OBJECT,
            properties:{
                'description': {
                    type: Type.STRING,
                    description: 'Provide a detailed description of this activity, including what mechanics (if any) a player would face and potential rewards',
                    nullable: false,
                }
            },
            required: ['description'],
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.StatusEffectKeywordSchema = {
            type: Type.OBJECT,
            properties:{
                'description': {
                    type: Type.STRING,
                    description: 'Provide a detailed description of this status effect and how it aids the player in activities',
                    nullable: false,
                },
                'productionMechanisms': {
                    type: Type.STRING,
                    description: 'Provide examples and descriptions for the way this status effect can be produced',
                    nullable: false,
                },
                'boosts':{
                    type: Type.STRING,
                    description: 'Provide examples and descriptions for how this effect can be boosted by certain perks or combination of subclass abilities',
                }
            },
            required: ['description', 'productionMechanisms', 'boosts'],
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        schemas.ChampionsKeywordSchema = {
            type: Type.OBJECT,
            properties:{
                'description': {
                    type: Type.STRING,
                    description: "Provide a detailed description of this champion and where it is usually encountered",
                    nullable: false,
                },
                'combatMechanisms': {
                    type: Type.STRING,
                    description: "Provide examples and descriptions for how this champion can be combatted and eliminated in activities",
                }
            },
            required: ['description', 'combatMechanisms'],
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
                //required: ["environment", "teamperformance", "WeaponAnalysis", "activitysummary", "combatAnalysis", "duration"],
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
        schemas.activitySkillsSchema = {
            type: Type.OBJECT,
            properties:{

            }
        }
        /////////////////////////////////////////////////////
        schemas.characterAnalysis = {
            type: Type.OBJECT,
            properties:{
                'characterSummary':{
                    type: Type.STRING,
                    description: "Analysis of what activities/environments this build is most effective in, or if its more of a general purpose build",
                    nullable: false,
                },
                'producableEffects':{
                    type: Type.STRING,
                    description: "Overview of what status effects this build can produce, and how they are produced. Include here effect sources such as those produced by the subclass as well as any perks on armors or weapons",
                    nullable: false,
                },
                'weaponConfiguration':{
                    type: Type.ARRAY,
                    description: "An array containing an object of analysis for each weapon the character has equipped",
                    nullable: false,
                    items:{
                        type: Type.OBJECT,
                        description: "An object containing the analysis of an equipped weapon",
                        properties:{
                            'name':{
                                type: Type.STRING,
                                description: "The name of this weapon",
                                nullable: false,
                            },
                            'weaponType':{
                                type: Type.STRING,
                                description: "This weapons type such as auto rifle, machine gun, etc.",
                                nullable: false,
                            },
                            'slot':{
                                type: Type.STRING,
                                description: "The slot this weapon takes on the character",
                                nullable: false,
                            },
                            'typeAdvantages':{
                                type: Type.STRING,
                                description: "Analyze the advantages of this weapons type, such as its typical damage output, environments in the game it is geared towards, as well enemy types its most effective against",
                                nullable: false,
                            },
                            'producableEffects':{
                                type: Type.STRING,
                                description: "What effects can this weapon produce or provide boosts for, if any, and how does it benefit the player. If it does not boost or produce, state that",
                                nullable: false,
                            },
                            'perkAdvantages':{
                                type: Type.STRING,
                                description: "Give a detailed explanation of the advantages provided by this weapons perks and how they might aid a player in different combat situations",
                                nullable: false,
                            },
                            'perkDisadvantages':{
                                type: Type.STRING,
                                description: "Are these weapon perks the best they could be? Should the player consider finding different rolls of this weapon with better perks",
                                nullable: false,
                            },
                            'statAdvantages':{
                                type: Type.STRING,
                                description: "Give a detailed analysis of the advantages provided by this weapons stats and how they might aid a player in different combat situations",
                            }
                        },
                        required: ["typeAdvantages","slot","weaponType","name","producableEffects","perkAdvantages","perkDisadvantages","statAdvantages"],
                    }
                },
                'armorConfiguration':{
                    type: Type.ARRAY,
                    description: "An array containing an object of analysis for each armor piece the character has equipped",
                    nullable: false,
                    items:{
                        type: Type.OBJECT,
                        description: "An object containing the analysis of an equipped armor piece",
                        properties:{
                            'name':{
                                type: Type.STRING,
                                description: "The name of this armor piece",
                            },
                            'slot':{
                                type: Type.STRING,
                                description: "The slot this armor piece takes on the character",
                            },
                            'perkAdvantages':{
                                type: Type.STRING,
                                description: "Give a concise description of each perk this armor piece has equipped, their advantages, and how they could aid a player in different combat situations",
                                nullable: false,
                            },
                            'perkDisadvantages':{
                                type: Type.STRING,
                                description: "Are these armor perks the best they could be? Should the player consider switching some out, do they cohere to the rest of the characters build (do they provide direct boosts to the equipped weapons, damage types, abilities, effects, etc.), do they hinder some other aspects?",
                                nullable: false,
                            },
                            'statAdvantages':{
                                type: Type.STRING,
                                description: "Give a concise analysis of the advantages provided by this armor stats and how they might aid a player in different combat situations",
                            },
                            'statDisadvantages':{
                                type: Type.STRING,
                                description: "Do these stats focus too much on singular character stats, or do they provide a more general boost to all stats. Considering the rest of the character build, could it be beneficial to equip armor that focus on specific statistics such as resilience, strength or any other type",
                                nullable: false,
                            }
                        },
                        required: ["slot","name","perkAdvantages","perkDisadvantages","statAdvantages","statDisadvantages"],
                    }
                },
                'exoticChoices':{
                    type: Type.ARRAY,
                    description: "An array containing an object entry for each exotic equipped. If no exotics are equipped, a singular object explain why that leaves the player at a disadvantage",
                    nullable: false,
                    items:{
                        type: Type.OBJECT,
                        description: "An object containing the analysis of an equipped exotic",
                        properties:{
                            'name':{
                                type: Type.STRING,
                                description: "The name of this exotic",
                            },
                            'advantages':{
                                type: Type.STRING,
                                description: "Give a detailed analysis of the advantages provided by this exotic and how they might aid a player in different combat situations. Focus on the intrinsic traits it provides.",
                                nullable: false,
                            }
                        },
                        required: ["name","advantages"],
                    }
                },
                'subclassConfiguration':{
                    type: Type.OBJECT,
                    description: "An object containing the analysis of the subclass configuration",
                    properties:{
                        'producableEffects': {
                            type: Type.ARRAY,
                            description: "An array of objects with an entry for each status effect this subclass configuration can produce",
                            nullable: false,
                            items:{
                                type: Type.OBJECT,
                                description: "An object containing a description of the status effect and how it can be produced and boosted",
                                properties:{
                                    'name':{
                                        type: Type.STRING,
                                        description: "The name of this effect",
                                        nullable: false,
                                    },
                                    'advantages':{
                                        type: Type.STRING,
                                        description: "Give a detailed analysis of the advantages this effect provides the player and how it might aid them in different combat situations",
                                        nullable: false,
                                    },
                                    'productionMechanism':{
                                        type: Type.STRING,
                                        description: "Give a detailed description of how this effect is produced and how it might be boosted (e.g. longer duration, boost to damage output or overall surivability, etc.)",
                                        nullable: false,
                                    },

                                }
                            }
                        },
                        'melee':{
                            type: Type.STRING,
                            description: "Give a detailed analysis of the melee ability provided by this subclass configuration and how it can aid a player in different combat situations",
                            nullable: false,
                        },
                        'grenade':{
                            type: Type.STRING,
                            description: "Give a detailed analysis of the grenade ability provided by this subclass configuration and how it can aid a player in different combat situations",
                            nullable: false,
                        },
                        'classAbility':{
                            type: Type.STRING,
                            description: "Give a detailed analysis of the class ability provided by this subclass configuration and how it can aid a player in different combat situations",
                            nullable: false,
                        },
                        'superAbility':{
                            type: Type.STRING,
                            description: "Give a detailed analysis of the super ability provided by this subclass configuration and how it can aid a player in different combat situations",
                            nullable: false,
                        },
                        'aspects':{
                            type: Type.STRING,
                            description: "A detailed analysis of the aspect choices for this build, if they cohere well to the rest of this build, how they provide the player an advantage, and what sitations and combat environments they are geared towards",
                            nullable: false,
                        },
                        'fragments':{
                            type: Type.STRING,
                            description: "A detailed analysis of the fragments chosen for this build, if they cohere well to the rest of this build, how they provide the player an advantage, and what sitations and combat environments they are geared towards",
                            nullable: false,
                        }
                    },
                    required: ["producableEffects"],

                },
                'summary':{
                    type: Type.STRING,
                    description: "Give a detailed summary of the character build and the possible reason behind its configuration (what activities or activity do you think it is optimised for, or if it doesnt seem optimized, state thus), as well as its overall advantages and what it prioritises (such as survivability, damage output, etc.)",
                    nullable: false,
                }

            },
            required:["characterSummary","producableEffects","weaponConfiguration","armorConfiguration","exoticChoices","subclassConfiguration","summary"],
        }
        this.schemas = schemas;
        /////////////////////////////////////////////////////
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
}