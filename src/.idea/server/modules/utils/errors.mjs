///////////////////////////////////////////////////////////////////////////////////////
export class AuthError extends Error {

    constructor(message,code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
///////////////////////////////////////////////////////////////////////////////////////
export class UserNotFoundError extends Error {
    constructor() {
        super("No user found for this refresh token");
        this.code = 1101;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
//////////////////////////////////////////////////////////////////////////////////////
export class InitError extends Error {
    constructor(message,code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
///////////////////////////////////////////////////////////////////////////////////////
export class InvalidTokenError extends Error {
    constructor() {
        super("The provided token is invalid and no user was found");
        this.code = "INVALID_TOKEN_ERR";
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
///////////////////////////////////////////////////////////////////////////////////////
export class DatabaseError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
//////////////////////////////////////////////////////////////////////////////////////