var db = null;
var destiny = null;
var DEBUG = false;
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function authorizeUser(coach,code=null,refresh=null) {

    if(refresh){//if a token cookie is present then this is not a new user

        console.log("User Services (Authorisation):// Authorisation by refresh token");
        await db.getUser(cookie, refresh);

    }else if(code){//if an OAuth code is present, this is likely a new user
        console.log("User Services (Authorisation):// Authorisation by OAuth2 code");
        coach.details = await destiny.getNewUser(code);//even if this isnt a new user, we have no way to tell if they are in the db without getting bungie data

        if(await db.checkForUser(coach.getDisplayName())){//check if this is a case where a refresh token cookie has expired or the user went back through bungies OAuth

            await db.refreshUser(coach.getDisplayName());//refresh users data on the database

            await db.updateRefresh(coach.getRefreshToken(),coach.getRefreshExpiry(),coach.getDisplayName());//update user token in database seen as we had no choice but to authorise with bungie first

            //getUserItems(coach.getDisplayName());

        }else{
            await db.newUser(coach.details);

            console.log("User Services (Async): Retrieving player items to store in database");

            destiny.getAccountActivityReports(coach.getMembershipId(),coach.getMemberType(),coach.getCharacterIds(),coach.getAccessToken(),7);

            destiny.getCharacterInventoryItemsAndVault(coach.getAccessToken(),coach.getCharacterIds(),coach.getMembershipId(),coach.getMemberType()).then(result =>{
                try{//database interaction can throw custom errors that need handling
                    sendItemsToDatabase(result,coach.getDisplayName());

                }catch (error){
                    console.log(error);
                }

            });

        }

    }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 *
 * @param userItems A two, dimensional array of x-len 2, index 0 representing armors and index 1 being weapons. This function
 * expects this array to be sorted before hand into the seperate item denominations
 * @param userid The user id (bungie display name) we are storing these items for
 * @returns {Promise<void>} does not return anything, utilises asynchronous methods, option to await this function may
 * be of use in future
 */
async function sendItemsToDatabase(userItems, userid){
    console.log("User Services (Async): Storing Weapons");
    for(var weapon in userItems[1]){
        await db.storeItem(
            [userItems[1][weapon].instance,
            userItems[1][weapon].itemId.toString(),
            userid,
            userItems[1][weapon].name,
            userItems[1][weapon].power.toString(),
            userItems[1][weapon].item_type,
            userItems[1][weapon].damage,
            JSON.stringify(userItems[1][weapon].stats),
            JSON.stringify(userItems[1][weapon].perks)],
            "Weapon");
    }
    console.log("User Services (Async): Storing Armors");
    for(var armor in userItems[0]){
        await db.storeItem(
            [
                userItems[0][armor].instance,
                userItems[0][armor].itemId,
                userid,
                userItems[0][armor].name,
                userItems[0][armor].power.toString(),
                userItems[0][armor].item_type,
                JSON.stringify(userItems[0][armor].stats),
                JSON.stringify(userItems[0][armor].perks)
            ],"Armor"
        )
    }
    console.log("User Services (Async): All items stored sucessfully");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getUserItems(userid){
    const result = await db.getUserItems(userid);

    const weapons= [result[0]];
    const armors = [result[1]];


}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromBungie(code){
    return await destiny.getNewUser(code);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getPlayerFromDB(){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function injectDependencies(bungie,database){
    destiny = bungie;
    db = database;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function initialise(destiny,database){
    console.log("User Services:// Initialising Service");
    injectDependencies(destiny,database);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default {
    authorizeUser,
    getUserItems,
    initialise
}

export const authServices = {
    getPlayerFromBungie,
    getPlayerFromDB
}