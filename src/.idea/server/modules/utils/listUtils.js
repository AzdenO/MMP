////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function seperateItems(items){

    const armors = items.filter(i => ["Helmet","Chest Armor","Gauntlets","Leg Armor","Class Armor"].includes(i.Slot));
    const weapons = items.filter(i => ["Energy Weapons","Kinetic Weapons","Power Weapons"].includes(i.Slot));
    const subclasses = items.filter(i => ["Subclass"].includes(i.Slot));
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