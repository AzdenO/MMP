/**
 * @module ErrorHandler
 * @description This module deals specifically with handling server responses when errors occur whilst processing a request
 * such as an invalid token, character id, activity id and so forth
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth (drw8)
 */
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 * Import all response bodies defined as JS constants
 */
import * as BodyConstants from "../../constants/responseConstants.mjs";
/*
 * Import all errors that can be thrown across the server, as these are mostly handled at the top level of the endpoints
 */
import * as ServerErrors from "../errors.mjs";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function that takes an error object and configures the response appropriately. Uses a chain of if-else if blocks to
 * check the error class type
 * @param {Error} err The error caught at the endpoint
 * @param {Response} res The response object provided by the express module to send back to the client with sanitized error
 * content
 * @returns Void
 */
export function handle(err, res){
    console.log("Server Error Handler:// Error in request processing:");
    if(err instanceof ServerErrors.InvalidTokenError){
        console.log("\tProvided token is invalid");
        res.status(401);
        res.json(BodyConstants.invalidTokenBody);
    }
    if(err instanceof ServerErrors.ReasonerError){
        handleReasonerError(err, res);
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to handle the ReasonerError instance, checking the code as this can throw errors where the server is at fault,
 * or some argument passed by the client is at fault
 * @param err
 * @param res
 */
function handleReasonerError(err, res){
    switch(err.code){
        case "INVALID_KEYWORD_TYPE":
            res.status(400);
            res.json(BodyConstants.invalidParamsBody);
            break;
        default:
            res.status(500);
            res.json(BodyConstants.ServerErrorBody);
            break;
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to handle the BungieError instance that can be thrown when requesting or parsing data from bungie, the code is checked
 * so sanitization can be performed and send as verbose a response as possible
 * @param {Error} err The error object caught at the endpoint
 * @param {Response} res The response object provided by the express module
 */
function handleBungieError(err,res){

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////