////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function seperateItems(items){

    const armors = items.filter(i => i.slot in ["Helmet","Chest Armor","Gauntlets","Leg Armor","Class Armor"]);
    const weapons = items.filter(i => i.slot in ["Energy Weapons","Kinetic Weapons","Power Weapons"]);
    const subclasses = items.filter(i => i.slot in ["Subclass"]);
    return [armors,weapons,subclasses];
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function convertToMap(array, mapTo){
    const returnable = array.reduce((map, object) => {
        map[object[mapTo]] = object;
        return map;
    },{});
    return returnable;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////