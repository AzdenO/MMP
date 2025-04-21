

/**
 *
 * @type {null}
 */
var tokenManager = null;
var bungieAuth = null;
var dbAuth = null;
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function used at all endpoints where a users data is involved, passing in an access token
 * @param {string} token An access token assocaited with a particular user, provided to the server by the bungie api
 * @returns {Promise<string>} The user id associated with a token. This function will throw an error if no user could be found
 * @throws InvalidTokenError indicates that the provided access token does not map to a user, and the server will need to reject
 * the request
 */
export async function authorize(token){
    console.log("User Authentication:// Access token authentication in progress");
    try{
        const userid = await tokenManager.queryDatabaseForToken(token, true);
        console.log("User Authentication:// Authentication successfull");
        return userid;

    }catch(error){
        if(error instanceof InvalidTokenError){
            console.log("User Authentication:// No user entry found for provided token");
            throw new InvalidTokenError();
        }
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to use the provided refresh token and exchange for a new set of tokens
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
export async function reAuthorise(refreshToken){
    try{
        const tokens = bungieAuth.getUserAccess(token, true);
        const userid = dbAuth.getUserIDByRefresh(refreshToken);
        dbAuth.updateTokens({//update access tokens
            token: tokens.access,
            expiry: tokens.access_expiry,
            userid: userid
        }, true);
        dbAuth.updateTokens({//update refresh tokens
            token: tokens.refresh,
            expiry: tokens.refresh_expiry,
            userid: userid
        }, false);
    }catch(error){

    }
    return {
        accessToken: tokens.access,
        refreshToken: tokens.refresh,
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method for authenticating on the server via OAuth2 code
 * @param {Coach} coach Coach object to initialise
 * @param {string} code the OAuth2 code to give to bungie and exchange for tokens
 * @returns {Promise<void>}
 */
export async function baseAuthentication(coach, code){
    console.log("User Authentication:// Base authorisation in progress");
    coach.details = await bungieAuth.getNewUser(code);

    if(await dbAuth.checkForUser(coach.getDisplayName())){
        dbAuth.updateTokens({
            token: coach.getAccessToken(),
            expiry: coach.getAccessExpiry(),
            userid: coach.getDisplayName()
        }, true);
        dbAuth.updateTokens({
            token: coach.getRefreshToken(),
            expiry: coach.getRefreshExpiry(),
            userid: coach.getDisplayName()
        }, false);
    }else{

        await dbAuth.newUser(coach.details);
        console.log("User Authentication://");
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 *
 * @param manager The object exported by the token manager module, passed to this module at server initialisation as a
 * dependency
 */
export function setDependencies(manager, bungie, dbauth){
    tokenManager = manager;
    bungieAuth = bungie;
    dbAuth = dbauth;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////