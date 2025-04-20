/**
 * A response body indicative of a request that did not include the correct parameters at an endpoint
 * @type {{success: boolean, message: string, errorCode: number}}
 */
export const invalidParamsBody = {
    success: false,
    message: "Request missing necessary header content",
    errorCode: 400
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * A response body indicative of a request made with an invalid token
 * @type {{success: boolean, message: string, errorCode: number}}
 */
export const invalidTokenBody = {
    success: false,
    message: "Provided token is invalid, reauthorisation required. If you do not have a valid token, please go back to /server/authorize with a valid bungie OAuth2 authorisation code",
    errorCode: 401
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * A response body indicative of a server-side error
 * @type {{success: boolean, message: string, errorCode: number}}
 */
export const ServerErrorBody = {
    success: false,
    message: "A server-side error occured, please try again later",
    errorCode: 500,
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////