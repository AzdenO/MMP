/**
 * @module stringUtils
 * @description Module to encapsulate methods for string manipulation
 * @version 0.1.0
 * @author Declan Roy Alan Wadsworth (drw8)
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * REPLACE MULTIPLE DIFFERENT WORDS IN A STRING
 * A method to replace multiple different words/patterns in a string with different values
 * @param {regex} regex regex pattern encasing the different words to replace
 * @param {Object} values key:value store of WordToReplace:ReplaceWith
 * @param {string} string the string to operate on
 * @returns {*}
 */
export function replaceMultiple(regex,replacements,string){
    return string.replace(regex, replace =>{
        const values = replacements;
        return values[replace];
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////