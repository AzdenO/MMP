/**
 * @module ParamHandler
 * @description Module to parse endpoint parameters including path, header and query parameters
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth
 */
import {invalidParamsBody} from "../../constants/responseConstants.mjs";
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Method to parse query, path and header parameters of a request with the provided object giving each parameter type an
 * array of keys to query that parameter type for
 * @param {Request} req The request object provided by the express module
 * @param {Response} res The response object provided by the express module to send back to the client in case of missing parameters
 * @param {Object} paramObject An object of key-value stores where the key string maps to a parameter type, and the value contains
 * an array of key strings of parameters to extract. Parameter types that are not needed are omitted
 * @returns {Object/boolean} An object of key value stores with each parameter type and the parameter data requested. If the
 * request doesnt contain the necessary parameters, the error response is sent and a boolean is returned instead
 */
export function parseAllParams(req, res, paramObject){
    var extractedParams = {};
    /*
     * If-Else block to check if the parameter object contains entries for specific parameter types
     */
    if(paramObject.path){
        extractedParams.path = pathParamParser(req, paramObject.path, res);
        if(!extractedParams.path){
            logBadParams();
            res.status(400).json(invalidParamsBody);
            return false;
        }
    }
    if(paramObject.query){
        extractedParams.query = queryParamParser(req, paramObject.query, res);
        if(!extractedParams.query){
            logBadParams();
            res.status(400).json(invalidParamsBody);
            return false;
        }
    }
    if(paramObject.header){
        extractedParams.header = headerParamParser(req, paramObject.header, res);
        if(!extractedParams.header){
            logBadParams();
            res.status(400).json(invalidParamsBody);
            return false;
        }
    }
    return extractedParams;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to parse path parameters of a request with the provided keys
 * @param {Request} req The request object provided by the express module
 * @param {Array<string>} keys The key-value strings to parse the path parameters for by iteration
 * @param {Response} res The response object provided by the express module to send back if any parameters are missing
 */
export function pathParamParser(req,keys, res){
    const found = iterateKeys(keys, req.params);
    if(!found){
        return false;
    }
    return found;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function queryParamParser(req,keys, res){
    const found = iterateKeys(keys, req.query);
    if(!found){
        return false;
    }
    return found;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function headerParamParser(req,keys, res){
    const found = iterateKeys(keys, req.headers);
    if(!found){
        return false;
    }
    return found;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to iterate over the array of key-strings and find matching values in the request parameter object passed,
 * if a key is missing, returns false
 * @param {Array<String>} keys The keystrings to extract
 * @param {Object} paramObject The parameter object attached to the request objected provided by the express module
 * @returns {Object/boolean} Return either an object containing the necessary values or a boolean to indicate missing content
 */
function iterateKeys(keys, paramObject){
    var returnable = {};
    for(const keystring of keys){
        if(paramObject[keystring]){
            returnable[keystring] = paramObject[keystring];
        }else{
            return false;
        }

    }
    return returnable;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function logBadParams(){
    console.log("Request Parameter Handler: Bad Parameters");
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////