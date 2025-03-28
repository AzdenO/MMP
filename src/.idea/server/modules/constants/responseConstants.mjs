export const invalidParamsBody = {
    success: false,
    message: "Request missing necessary header content",
    errorCode: 400
}
export const invalidTokenBody = {
    success: false,
    message: "Provided token is invalid, reauthorisation required. If you do not have a refresh token, please go back to /server/authorize with a valid bungie OAuth2 authorisation code",
    errorCode: 401
}