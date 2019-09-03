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

        } else throw new Error(`El usuario ${userName} ya fue registrado`);
        
    }


    async queryUser (ctx, userName){

        const key = userName;
        const userAsBytes = await ctx.stub.getState(key);
        if (!userAsBytes || userAsBytes.length === 0) {
            throw new Error(`${userName} no existe`);
        }
        
        return userAsBytes.toString();

    }

    async updateUser(ctx, userName, dataEncrypt){

        const key = userName;
        const userAsBytes = await ctx.stub.getState(key);
        if (!userAsBytes || userAsBytes.length === 0) {
            throw new Error(`${userName} no existe`);
        }
        
        await ctx.stub.putState(userName, Buffer.from(dataEncrypt));

        return 'contraseña actualizada'

    }

}

module.exports = UsersContract;