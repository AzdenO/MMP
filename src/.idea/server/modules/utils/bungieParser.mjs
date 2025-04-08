
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @param object The object (after json.parse) containing all weapon statistics as a collection of objects
 * @returns {Array} An array of key-values (objects) in the form of {weapontype: string, precisionkills: int, normal kills: int}
 */
//auto rifle, Beam Rifle, Bow, Glaive, Fusion Rifle, Grenades, Hand Cannon, Melee, pulse rifle, rocket launcher,
export function parseWeaponStats(object){
    var prefixes = ["weaponPrecisionKills","weaponKills"];

    delete object.activitiesEntered;//is the second object in the collection and will mess with iterating through entries
    var results = [];
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
    return results;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////