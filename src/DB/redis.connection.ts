import { createClient, RedisClientType } from "redis"
import { REDIS_URI } from "../config/config.service.js";

export class RedisService{
    private readonly redisClient:RedisClientType
    constructor(){
        this.redisClient=createClient({
            url: REDIS_URI
        })
        this.handleEvent()
    }

    handleEvent(){
        this.redisClient.on("error",(error)=>{
            console.log('Redis Error:',error.message);
        })
    }

    async connect(){
        await this.redisClient.connect()
        console.log("redis connection stablish successfully");
    }

    
    setValue = async ({ key, value, ttl }:{key:string,value:string,ttl:number}) => {
        try {
            const mainValue = (typeof value === "object" && value !== null)
                ? JSON.stringify(value)
                : value;

            const options = ttl ? { EX: ttl } : {};
            return await this.redisClient.set(key, mainValue, options);
        } catch (error) {
            console.error(error, "\n redis setValue Error");
            throw error;
        }
    }


    updateValue = async ({ key, value,ttl}: {
        key: string;
        value: string | object;
        ttl?: number;
    }): Promise<number> => {
        try {
            const mainValue = typeof value === "string"
                ? value
                : JSON.stringify(value);
            const options: { XX: true; EX?: number } = {
                XX: true
            };
            if (ttl) {
                options.EX = ttl;
            }
            const result = await this.redisClient.set(
                key,
                mainValue,
                options
            );
            return result === "OK" ? 1 : 0;
        } catch (error) {
            console.error("Redis updateValue Error:", error);
            throw error;
        }
    };


    getValue = async (key:string) => {
        try {
            const data = await this.redisClient.get(key);
            if (data === null || data === undefined) return null;

            try {
                return JSON.parse(data);
            } catch {
                return data;
            }
        } catch (error) {
            console.error(error, "\n redis getValue Error");
            throw error;
        }
    }

    ttl = async (key:string) => {
        try {
            return await this.redisClient.ttl(key);
        } catch (error) {
            console.error(error, "\n redis ttl Error");
            throw error;
        }
    }

    expire = async ({ key, ttl }:{key:string,ttl:number}) => {
        try {
            return await this.redisClient.expire(key, ttl);
        } catch (error) {
            console.error(error, "\n redis expire Error");
            throw error;
        }
    }

    deleteKey = async (key:string|string[]) => {
        try {
            return await this.redisClient.del(key);
        } catch (error) {
            console.error(error, "\n redis deleteKey Error");
            throw error;
        }
    }

    keys = async (key:string|string[]) => {
        try {
            return await this.redisClient.keys(`${key}*`);
        } catch (error) {
            console.error(error, "\n redis keys Error");
            throw error;
        }
    }

    incr = async (key:string) => {
        try {
            return await this.redisClient.incr(key);
        } catch (error) {
            console.error(error, "\n redis incr Error");
            throw error;
        }
    }

    existValue = async (key:string) => {
        try {
            return await this.redisClient.exists(key);
        } catch (error) {
            console.error(error, "\n redis exists Error");
            throw error;
        }
    }
}

export const RedisInstance=new RedisService();
