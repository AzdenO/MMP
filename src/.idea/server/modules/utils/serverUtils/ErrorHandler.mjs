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
import * as BodyConstants from "../../constants/responseConstants.mjs"
import * as ServerErrors from "../errors.mjs";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function that takes an error object and configures the response appropriately
 * @param {Error} err The error caught at the endpoint
 * @param {Response} res The response object provided by the express module
 * @returns {Promise<void>}
 */
export function handle(err, res){
    if(err instanceof ServerErrors.InvalidTokenError){
        res.status(401);
        res.json(BodyConstants.invalidTokenBody);
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////