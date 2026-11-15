

export class AppException extends Error{
    constructor (message:string,public status:number,cause?:unknown){
        super(message,{cause})
        this.name=this.constructor.name;
        Error.captureStackTrace(this,this.constructor)
    }
}

export class BadRequestException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Bad Request",400,cause)
    }
}

export class NotFoundException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Not Found",404,cause)
    }
}

export class UnauthorizedException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Unauthorized",401,cause)
    }
}

export class ForbiddenException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Forbidden",403,cause)
    }
}

export class ConflictException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Conflict",409,cause)
    }
}

export class InternalServerErrorException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Internal Server Error",500,cause)
    }
}

export class TooManyRequestsException extends AppException{
    constructor(message:string,cause:unknown){
        super(message="Too Many Requests",429,cause)
    }
}

