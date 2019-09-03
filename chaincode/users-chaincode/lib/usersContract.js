'use strict';
const { Contract } = require('fabric-contract-api');

class UsersContract extends Contract {



    async init(ctx) {

    }

    async registerUser(ctx, userName, dataEncrypt) {

        const key = userName;
        let userAsBytes = await ctx.stub.getState(key);
        if (!userAsBytes || userAsBytes.length === 0) {

            await ctx.stub.putState(key, Buffer.from(dataEncrypt));

        } else throw new Error(`User ${userName} has already been registered`);

        return 'User Successfully registered in blockchain'
        
    }


    //Retorna un string con el usuario, si no se encuentra retorna un string vacío
    async queryUser (ctx, userName){

        const key = userName;
        const userAsBytes = await ctx.stub.getState(key);
        if (!userAsBytes || userAsBytes.length === 0) {
            //throw new Error(`${userName} not found`);
            return null;
        }
        
        return userAsBytes.toString();

    }

    async updateUser(ctx, userName, dataEncrypt){

        const key = userName;
        const userAsBytes = await ctx.stub.getState(key);
        if (!userAsBytes || userAsBytes.length === 0) {
            throw new Error(`${userName}  not found`);
        }
        
        await ctx.stub.putState(userName, Buffer.from(dataEncrypt));

        return 'Updated password'
        

    }

}

module.exports = UsersContract;