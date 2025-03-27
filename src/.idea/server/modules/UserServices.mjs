var db = null;
var destiny = null;
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function authorizeUser(coach,code=null,cookie=null) {

    if(cookie){//if a token cookie is present then this is not a new user

        console.log("User Services (Authorisation):// Authorisation by refresh token");
        await db.getUser(cookie, coach);

    }else if(code){//if an OAuth code is present, this is likely a new user
        console.log("User Services (Authorisation):// Authorisation by OAuth2 code");
        await destiny.getNewUser(code, coach);//even if this isnt a new user, we have no way to tell if they are in the db without getting bungie data
        if(await db.checkForUser(coach.getDisplayName())){//check if this is a case where a refresh token cookie has expired or the user went back through bungies OAuth
            await db.refreshUser(coach.getDisplayName());//refresh users data on the database
            await db.updateRefresh(coach.getRefreshToken(),coach.getRefreshExpiry(),coach.getDisplayName());//update user token in database seen as we had no choice but to authorise with bungie first
        }else{
            await db.newUser(coach.details);
            const userItems = destiny.getCharacterInventoryItemsAndVault(coach.getAccessToken(),coach.getCharacterIds(),coach.getMembershipId(),coach.getMemberType());

            sendItemsToDatabase(userItems,coach.getDisplayName());
        }

    }

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function sendItemsToDatabase(userItems, userid){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function getUserItems(userid){

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
    initialise
}