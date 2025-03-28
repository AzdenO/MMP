////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * REPLACE MULTIPLE DIFFERENT WORDS IN A STRING
 * A method to replace multiple different words/patterns in a string with different values
 * @param regex regex pattern encasing the different words to replace
 * @param values key:value store of WordToReplace:ReplaceWith
 * @param string the string to operate on
 * @returns {*}
 */
export function replaceMultiple(regex,replacements,string){
    return string.replace(regex, replace =>{
        const values = replacements;
        return values[replace];
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////