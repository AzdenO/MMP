/**
 * @module BungieConstants
 * @description holds static data about Destiny 2 that isnt accessible via http endpoints, such as the activity
 * mode type enumeration. Most static data bout the game is able to be queried at manifest endpoints, but for data that cannot,
 * this is where they are hard coded. Any changes to the API data, will need to be manually updated here
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth (drw8)
 * @bungieApiVersion 1.20.1
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Constant variable to hold activity mode types. This enumeration isnt available at any bungie endpoint, therefore it is
 * hard coded here. The version on bungies github contains enumerations for reservered mode types. These are omitted here.
 * The list is an aggregation of Destiny 1 and Destiny 2 mode types. In this version of the module, I haven`t removed the D1
 * types yet, just copied the enum from bungies docs. This will occur in a later module version for better readability. This also
 * contains mode related to activity types that have been sunset from the game. These will also be removed in a future module version
 * as they are not useful, and error handling will take care if they ever occur when parsing activities or PGCRs
 * @type Object
 */
export const modeTypes = {
    0: "None",
    2: "Story",
    3: "Strike",
    4: "Raid",
    5: "AllPvP",
    6: "Patrol",
    7: "AllPvE",
    10: "Control",
    12: "Clash",
    15: "Crimson Doubles",
    16: "Nightfall",
    17: "Heroic Nightfall",
    18: "All Strikes",
    19: "Iron Banner",
    25: "All Mayhem",
    31: "Supremacy",
    32: "All Private Matches",
    37: "Survival",
    38: "Countdown",
    39: "Trials of the Nine",
    40: "Social",
    41: "Trials of Osiris: Countdown",
    42: "Trials of Osiris: Survival",
    43: "Iron Banner: Control",
    44: "Iron Banner: Clash",
    45: "Iron Banner: Supremacy",
    46: "Nightfall (Scored)",
    47: "Heroic Nightfall (Scored)",
    48: "Rumble",
    49: "All Doubles",
    50: "Doubles",
    51: "Private Match: Clash",
    52: "Private Match: Control",
    53: "Private Match: Supremacy",
    54: "Private Match: Countdown",
    55: "Private Match: Survival",
    56: "Private Match: Mayhem",
    57: "Private Match: Rumble",
    58: "Heroic Adventure",
    59: "Showdown",
    60: "Lockdown",
    61: "Scorched",
    62: "Scorched Teams",
    63: "Gambit",
    64: "All Competitive PvE",
    65: "Breakthrough",
    66: "Black Armory Run",
    67: "Salvage",
    68: "Iron Banner Salvage",
    69: "Competitive PvP",
    70: "PvP Quickplay",
    71: "Clash Quickplay",
    72: "Clash Competitive",
    73: "Control Quickplay",
    74: "Control Competitive",
    75: "Gambit Prime",
    76: "Reckoning",
    77: "Menagerie",
    78: "Vex Offensive",
    79: "Nightmare Hunt",
    80: "Elimination",
    81: "Momentum",
    82: "Dungeon",
    83: "Sundial",
    84: "Trials of Osiris",
    85: "Dares of Eternity",
    86: "Offensive",
    87: "Lost Sector",
    88: "Rift",
    89: "Zone Control",
    90: "Iron Banner Rift",
    91: "Iron Banner Zone Control",
    92: "Relic"
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Array of damage types, where the bungie enum in an applicable API response maps to the index in this array
 * @type {string[]} list of damage types where bungie damage type enum maps to the correct index
 */
export const damageTypes = ["Not Applicable","Kinetic","Arc","Solar","Void","Raid Damage","Stasis","Strand"];
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * An enumeration containing properties for each item subtype such as class armor, auto rifle, glaive, etc. This data cannot be
 * fetched from any Bungie API endpoint, so it is hardcoded here. The key is the enum on the bungie api, and its value the name
 * of the subtype
 * @type {{}}
 */
export const itemSubTypes = {
    0: "None",
    1: "Crucible",
    2: "Vanguard",
    5: "Exotic",
    6: "Auto Rifle",
    7: "Shotgun",
    8: "Machine Gun",
    9: "Hand Cannon",
    10: "Rocket Launcher",
    11: "Fusion Rifle",
    12: "Sniper Rifle",
    13: "Pulse Rifle",
    14: "Scout Rifle",
    17: "Sidearm",
    18: "Sword",
    19: "Mask",
    20: "Shader",
    21: "Ornament",
    22: "Fusion Rifle Line",
    23: "Grenade Launcher",
    24: "Submachine Gun",
    25: "Trace Rifle",
    26: "Helmet",
    27: "Gauntlets",
    28: "Chest Armor",
    29: "Leg Armor",
    30: "Class Armor",
    31: "Bow",
    32: "Glaive"
}