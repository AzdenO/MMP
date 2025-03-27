export function seperateItems(items){

    const armors = items.filter(i => i.item_type in ["Helmet","Chest Armor","Gauntlets","Leg Armor","Class Armor"]);
    const weapons = items.filter(i => i.item_type in ["Energy Weapons","Kinetic Weapons","Power Weapons"]);
    return [armors,weapons];
}