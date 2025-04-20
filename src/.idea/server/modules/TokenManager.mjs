/**
 * @module TokenManager
 * @description Module used to manage access to user tokens on the database, providing services such as updating tokens
 * on the database, querying the database for users with a provided token, and invalidation of tokens. This module also
 * peridoically updates the refresh tokens when they expire to ensure constant access. This module will remove tokens from
 * the database when the users last access is a period greater than 60 days
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth (drw8)
 * @UserDatabaseVersion 0.1.0
 */

/**
 * The database object with the necessary functions
 * @type {Object}
 */
var dbService = null;
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function used to access database module and its function to query the mySQL server database for a userid that matches
 * the provided token
 * @param {string} token the token we are querying for
 * @param {boolean} flag True if querying access token, false for refresh
 * @returns {Promise<string>} The userid associated with the token, will throw an error if no user was found
 */
export async function queryDatabaseForToken(token, flag){

    const userid = await dbService.queryToken(token, flag);
    return userid;

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function used at server initialisation to pass on the database authentication service object for this module to access
 * @param {Object} db The database dependency required by this module
 */
export function setDB(db){
    dbService = db;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////