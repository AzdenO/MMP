/**
 * @module databaseObjects
 * @description Module to hold JSDoc type definitions for transitory objects used by the module, for better readability
 * and to incorporate a stricter approach on types that can be passed
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @typedef {Object} TokenData
 * @property {string} token
 * @property {string} expiry
 * @property {string} userid
 *
 * @description This type is used for updating a users token on the database, passed to a function in the userdatabase module
 * @see module:user_database.updateTokens
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////